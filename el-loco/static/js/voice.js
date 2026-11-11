/* LOCO — voice.js  (Phase Two: optional voice chat)
   WebRTC audio between the two players. Socket.IO is used for signaling only
   (invite / accept / offer / answer / ICE). The game never depends on this file:
   if anything here fails, the board and chat keep working.

   States: idle -> calling (caller waits) | incoming (callee sees the modal)
           -> connecting -> connected -> idle                                  */
(function () {
    'use strict';

    const L = window.LOCO;
    const socket = L.socket;
    const $ = (id) => document.getElementById(id);

    const el = {
        start: $('voiceStart'), end: $('voiceEnd'),
        mic: $('voiceMic'), micIcon: $('voiceMicIcon'),
        spk: $('voiceSpk'), spkIcon: $('voiceSpkIcon'),
        spinner: $('voiceSpinner'), status: $('voiceStatus'),
        audio: $('voiceAudio'), modal: $('callModal')
    };

    const RING_TIMEOUT_MS = 45000;       // caller gives up if nobody answers
    const DISCONNECT_GRACE_MS = 8000;    // brief network blips are tolerated
    const FALLBACK_ICE = [{ urls: ['stun:stun.l.google.com:19302'] }];

    const supported = !!(window.RTCPeerConnection && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    let state = 'idle';
    let canCall = false;          // true while both players are in the room
    let isCaller = false;
    let pc = null;
    let stream = null;
    let pendingIce = [];
    let remoteSet = false;
    let reconnecting = false;
    let micMuted = false;
    let spkMuted = false;
    let token = 0;                // bumps on every reset: cancels async work that is still in flight
    let ringTimer = null;
    let discTimer = null;

    // ---------- UI ----------
    function show(node, on) { node.classList.toggle('d-none', !on); }

    function statusKey() {
        if (!supported) return 'voiceNoSupport';
        if (!window.isSecureContext) return 'voiceNeedsHttps';
        if (reconnecting) return 'voiceReconnecting';
        switch (state) {
            case 'calling': return 'voiceCalling';
            case 'incoming': return 'voiceIncoming';
            case 'connecting': return 'voiceConnecting';
            case 'connected': return 'voiceConnected';
            default: return canCall ? 'voiceIdle' : 'voiceNeedPlayer';
        }
    }

    function render() {
        const idle = state === 'idle';
        const inCall = state === 'calling' || state === 'connecting' || state === 'connected';

        el.status.textContent = L.t(statusKey());
        show(el.spinner, state === 'calling' || state === 'connecting' || reconnecting);

        show(el.start, idle);
        el.start.disabled = !(supported && window.isSecureContext && canCall && socket.connected);
        show(el.end, inCall);
        show(el.mic, inCall);
        show(el.spk, inCall);

        el.micIcon.className = 'bi ' + (micMuted ? 'bi-mic-mute-fill' : 'bi-mic-fill');
        el.spkIcon.className = 'bi ' + (spkMuted ? 'bi-volume-mute-fill' : 'bi-volume-up-fill');
        el.mic.classList.toggle('is-off', micMuted);
        el.spk.classList.toggle('is-off', spkMuted);

        const micText = L.t(micMuted ? 'micUnmute' : 'micMute');
        const spkText = L.t(spkMuted ? 'spkUnmute' : 'spkMute');
        el.mic.title = micText; el.mic.setAttribute('aria-label', micText);
        el.spk.title = spkText; el.spk.setAttribute('aria-label', spkText);
    }

    function modal() { return bootstrap.Modal.getOrCreateInstance(el.modal); }
    function hideModal() {
        const m = bootstrap.Modal.getInstance(el.modal);
        if (m) m.hide();
    }

    // ---------- Cleanup (microphone off, connection closed) ----------
    function stopStream(s) {
        if (s) s.getTracks().forEach((t) => { try { t.stop(); } catch (e) { /* ignore */ } });
    }

    function reset() {
        token++;
        clearTimeout(ringTimer);
        clearTimeout(discTimer);

        if (pc) {
            pc.onicecandidate = null;
            pc.ontrack = null;
            pc.onconnectionstatechange = null;
            try { pc.close(); } catch (e) { /* ignore */ }
            pc = null;
        }

        stopStream(stream);
        stream = null;
        el.audio.srcObject = null;

        pendingIce = [];
        remoteSet = false;
        reconnecting = false;
        micMuted = false;
        spkMuted = false;
        isCaller = false;
        state = 'idle';

        hideModal();
        render();
    }

    function fail(messageKey) {
        L.toast(L.t(messageKey || 'voiceFailed'), 'danger');
        socket.emit('voice_end');
        reset();
    }

    // ---------- Microphone (asked only when the player starts or accepts a call) ----------
    async function getMic() {
        if (!supported) { L.toast(L.t('voiceNoSupport'), 'danger'); return null; }
        if (!window.isSecureContext) { L.toast(L.t('voiceNeedsHttps'), 'danger'); return null; }

        try {
            return await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: false
            });
        } catch (err) {
            const name = err && err.name;
            let key = 'voiceFailed';
            if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') key = 'voiceMicDenied';
            else if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') key = 'voiceMicMissing';
            L.toast(L.t(key), 'danger');
            return null;
        }
    }

    function applyTrackState() {
        if (stream) stream.getAudioTracks().forEach((t) => { t.enabled = !micMuted; });
        el.audio.muted = spkMuted;
    }

    // ---------- ICE servers come from the server (STUN / TURN configured there) ----------
    function getIceServers() {
        return new Promise((resolve) => {
            let done = false;
            const timer = setTimeout(() => { if (!done) { done = true; resolve(FALLBACK_ICE); } }, 4000);
            socket.emit('voice_config', {}, (res) => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                resolve(res && res.ok && Array.isArray(res.iceServers) ? res.iceServers : FALLBACK_ICE);
            });
        });
    }

    // ---------- WebRTC ----------
    function createPeer(iceServers) {
        pc = new RTCPeerConnection({ iceServers: iceServers });
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.onicecandidate = (e) => {
            if (e.candidate) socket.emit('voice_ice', { candidate: e.candidate.toJSON() });
        };

        pc.ontrack = (e) => {
            el.audio.srcObject = e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]);
            el.audio.muted = spkMuted;
            const p = el.audio.play();
            if (p && p.catch) p.catch(() => {});
        };

        pc.onconnectionstatechange = () => {
            if (!pc) return;
            const s = pc.connectionState;

            if (s === 'connected') {
                clearTimeout(discTimer);
                reconnecting = false;
                state = 'connected';
                render();
            } else if (s === 'disconnected') {
                reconnecting = true;
                render();
                clearTimeout(discTimer);
                discTimer = setTimeout(() => {
                    if (pc && pc.connectionState !== 'connected') fail('voiceFailed');
                }, DISCONNECT_GRACE_MS);
            } else if (s === 'failed') {
                fail('voiceFailed');
            }
        };
    }

    async function flushIce() {
        const queued = pendingIce;
        pendingIce = [];
        for (const c of queued) {
            try { await pc.addIceCandidate(c); } catch (e) { /* stale candidate: ignore */ }
        }
    }

    // ---------- Caller ----------
    async function startCall() {
        if (state !== 'idle' || !canCall) return;

        const my = ++token;
        isCaller = true;
        state = 'calling';
        render();

        const s = await getMic();
        if (my !== token) { stopStream(s); return; }      // cancelled while the permission prompt was open
        if (!s) { reset(); return; }

        stream = s;
        applyTrackState();
        socket.emit('voice_invite');

        ringTimer = setTimeout(() => {
            if (state === 'calling') {
                L.toast(L.t('voiceNoAnswer'));
                socket.emit('voice_end');
                reset();
            }
        }, RING_TIMEOUT_MS);
        render();
    }

    async function onAccepted() {
        if (state !== 'calling' || !stream) return;
        clearTimeout(ringTimer);

        const my = token;
        state = 'connecting';
        render();

        const ice = await getIceServers();
        if (my !== token || state !== 'connecting') return;

        try {
            createPeer(ice);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('voice_offer', { sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
        } catch (e) {
            fail('voiceFailed');
        }
    }

    async function onAnswer(data) {
        if (!pc || !isCaller || !data || !data.sdp) return;
        try {
            await pc.setRemoteDescription(data.sdp);
            remoteSet = true;
            await flushIce();
        } catch (e) {
            fail('voiceFailed');
        }
    }

    // ---------- Callee ----------
    function onIncoming() {
        if (state !== 'idle') { socket.emit('voice_reject'); return; }
        state = 'incoming';
        render();
        modal().show();
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }

    async function acceptCall() {
        if (state !== 'incoming') return;

        const my = ++token;
        hideModal();
        isCaller = false;
        state = 'connecting';
        render();

        const s = await getMic();
        if (my !== token) { stopStream(s); return; }
        if (!s) { socket.emit('voice_reject'); reset(); return; }

        stream = s;
        applyTrackState();

        const ice = await getIceServers();
        if (my !== token || state !== 'connecting') return;

        try {
            createPeer(ice);              // ready to receive the offer BEFORE we tell the caller to send it
            socket.emit('voice_accept');
        } catch (e) {
            fail('voiceFailed');
        }
    }

    function rejectCall() {
        if (state !== 'incoming') return;
        socket.emit('voice_reject');
        reset();
    }

    async function onOffer(data) {
        if (!pc || isCaller || !data || !data.sdp) return;
        try {
            await pc.setRemoteDescription(data.sdp);
            remoteSet = true;
            await flushIce();
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('voice_answer', { sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
        } catch (e) {
            fail('voiceFailed');
        }
    }

    // ---------- Both sides ----------
    async function onIce(data) {
        if (!pc || !data || !data.candidate) return;
        if (!remoteSet) { pendingIce.push(data.candidate); return; }
        try { await pc.addIceCandidate(data.candidate); } catch (e) { /* ignore */ }
    }

    function endCall() {
        socket.emit('voice_end');
        reset();
    }

    // ---------- Events ----------
    el.start.addEventListener('click', startCall);
    el.end.addEventListener('click', endCall);
    $('callAccept').addEventListener('click', acceptCall);
    $('callReject').addEventListener('click', rejectCall);

    el.mic.addEventListener('click', () => { micMuted = !micMuted; applyTrackState(); render(); });
    el.spk.addEventListener('click', () => { spkMuted = !spkMuted; applyTrackState(); render(); });

    socket.on('voice_incoming', onIncoming);
    socket.on('voice_accepted', onAccepted);
    socket.on('voice_offer', onOffer);
    socket.on('voice_answer', onAnswer);
    socket.on('voice_ice', onIce);

    socket.on('voice_rejected', () => {
        if (state === 'idle') return;
        L.toast(L.t('voiceRejectedMsg'));
        reset();
    });

    socket.on('voice_ended', () => {
        if (state === 'idle') return;
        L.toast(L.t('voiceEnded'));
        reset();
    });

    socket.on('room_update', (data) => {
        canCall = !!data.started;
        if (!canCall && state !== 'idle') reset();      // opponent left: close everything
        else render();
    });

    socket.on('disconnect', () => { if (state !== 'idle') reset(); else render(); });
    socket.on('connect', render);
    document.addEventListener('loco:lang', render);
    window.addEventListener('pagehide', () => { stopStream(stream); });

    L.voice = { reset: reset };
    render();
})();
