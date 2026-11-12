/* LOCO — chat.js
   Real-time text chat. Uses the socket created in game.js (no second connection).
   Desktop: panel beside the board. Mobile/tablet: the same panel moves into a
   Bootstrap offcanvas. Messages are rendered with textContent only (no HTML injection). */
(function () {
    'use strict';

    const L = window.LOCO;
    const socket = L.socket;
    const $ = (id) => document.getElementById(id);

    const panel = $('chatPanel');
    const list = $('chatList');
    const empty = $('chatEmpty');
    const form = $('chatForm');
    const input = $('chatInput');
    const sendBtn = $('chatSend');
    const unreadBadge = $('chatUnread');
    const desktopSlot = $('chatDesktopSlot');
    const mobileSlot = $('chatOffcanvasBody');
    const offcanvasEl = $('chatOffcanvas');

    const MAX_NODES = 100;       // keep the DOM small in long games
    const MIN_GAP_MS = 400;      // client-side throttle (the server enforces the real limit)

    let unread = 0;
    let offcanvasOpen = false;
    let lastSend = 0;

    // ---------- Move the panel between desktop column and mobile offcanvas ----------
    const desktop = window.matchMedia('(min-width: 992px)');

    function placePanel() {
        const target = desktop.matches ? desktopSlot : mobileSlot;
        if (panel.parentNode !== target) target.appendChild(panel);
        if (desktop.matches) {
            const oc = bootstrap.Offcanvas.getInstance(offcanvasEl);
            if (oc) oc.hide();
        }
    }

    if (desktop.addEventListener) desktop.addEventListener('change', placePanel);
    else desktop.addListener(placePanel);
    placePanel();

    // ---------- Unread badge (mobile only) ----------
    function setUnread(n) {
        unread = n;
        unreadBadge.textContent = n > 9 ? '9+' : String(n);
        unreadBadge.classList.toggle('d-none', n === 0);
    }

    offcanvasEl.addEventListener('shown.bs.offcanvas', () => {
        offcanvasOpen = true;
        setUnread(0);
        list.scrollTop = list.scrollHeight;
    });
    offcanvasEl.addEventListener('hidden.bs.offcanvas', () => { offcanvasOpen = false; });

    // ---------- Messages ----------
    function formatTime(ts) {
        const d = new Date(ts);
        const date = isNaN(d.getTime()) ? new Date() : d;
        return date.toLocaleTimeString(L.lang === 'ar' ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' });
    }

    function addMessage(msg) {
        if (!msg || (msg.role !== 'X' && msg.role !== 'O') || typeof msg.text !== 'string') return;

        const mine = msg.role === L.getRole();

        const bubble = document.createElement('div');
        bubble.className = 'msg ' + (mine ? 'mine' : 'theirs');

        const meta = document.createElement('div');
        meta.className = 'msg-meta';

        const sym = document.createElement('span');
        sym.className = 'chat-sym ' + msg.role.toLowerCase();
        sym.textContent = msg.role;

        const time = document.createElement('span');
        time.className = 'msg-time';
        time.textContent = formatTime(msg.ts);

        meta.appendChild(sym);
        if (mine) {
            const you = document.createElement('span');
            you.textContent = L.t('you');
            meta.appendChild(you);
        }
        meta.appendChild(time);

        const text = document.createElement('div');
        text.className = 'msg-text';
        text.setAttribute('dir', 'auto');   // Arabic and English messages each align correctly
        text.textContent = msg.text;        // textContent => never interpreted as HTML

        bubble.appendChild(meta);
        bubble.appendChild(text);

        const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;

        empty.classList.add('d-none');
        list.appendChild(bubble);

        while (list.children.length > MAX_NODES + 1) {
            const first = list.children[1];      // children[0] is the "empty" hint
            if (first) first.remove(); else break;
        }

        if (mine || nearBottom) list.scrollTop = list.scrollHeight;

        if (!mine) notifyIncoming(msg);
    }

    // ---------- Incoming message: sound + light notification ----------
    const baseTitle = document.title;
    let titleCount = 0;

    function notifyIncoming(msg) {
        L.sfx('message');                                    // respects mute / sound-effects switch

        const chatVisible = desktop.matches || offcanvasOpen;

        if (!chatVisible) {
            setUnread(unread + 1);
            const preview = msg.text.length > 40 ? msg.text.slice(0, 40) + '…' : msg.text;
            // Tapping the notification opens the chat
            L.toast(L.t('newMessage') + ' — ' + preview, 'info', () => {
                bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl).show();
            });
        } else if (desktop.matches) {
            panel.classList.remove('flash');                 // restart the highlight animation
            void panel.offsetWidth;
            panel.classList.add('flash');
        }

        if (document.hidden) {                               // another tab is in front
            titleCount++;
            document.title = '(' + titleCount + ') ' + L.t('newMessage');
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) { titleCount = 0; document.title = L.t('siteTitle') || baseTitle; }
    });

    function reset() {
        Array.from(list.querySelectorAll('.msg')).forEach((el) => el.remove());
        empty.classList.remove('d-none');
        input.value = '';
        setUnread(0);
    }

    L.chat = { reset: reset };

    // ---------- Sending ----------
    function updateSendState() {
        sendBtn.disabled = !socket.connected;
        input.disabled = !socket.connected;
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const text = input.value.trim();
        if (!text) return;

        if (!socket.connected) {
            L.toast(L.t('err_not_connected'), 'danger');
            return;
        }

        const now = Date.now();
        if (now - lastSend < MIN_GAP_MS) return;
        lastSend = now;

        socket.emit('chat_message', { text: text.slice(0, 200) });
        input.value = '';
        input.focus();
    });

    socket.on('chat_message', addMessage);
    socket.on('connect', updateSendState);
    socket.on('disconnect', updateSendState);
    updateSendState();
})();
