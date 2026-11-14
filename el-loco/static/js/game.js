/* LOCO — game.js
   Socket.IO connection, lobby, online rooms, play-vs-computer, rounds (1 / 3 / 5),
   nudge, board, confirmations (restart / leave) and the "you will lose your progress" warning.
   Server events: join_game, your_role, room_update, make_move, leave_game,
   match_config, match_ready, next_round, nudge / nudged,
   restart_request, restart_requested, restart_response, restart_declined, error_message. */
(function () {
    'use strict';

    const L = window.LOCO;
    const $ = (id) => document.getElementById(id);

    // ONE socket for the whole page; chat.js and voice.js reuse it
    const socket = L.socket = io();

    const lobby = $('lobby');
    const game = $('game');
    const roomInput = $('roomInput');
    const boardEl = $('board');
    const cells = Array.from(boardEl.querySelectorAll('.cell'));
    const marks = cells.map((c) => c.firstElementChild);
    const statusEl = $('status');
    const restartBtn = $('restartBtn');

    const BOT_DELAY_MS = 550;        // the computer "thinks" a little
    const RESTART_WAIT_MS = 30000;   // matches the server-side TTL
    const NUDGE_COOLDOWN_S = 8;      // matches the server-side gap

    const opp = (s) => (s === 'X' ? 'O' : 'X');

    // ---------- State ----------
    let mode = 'online';             // 'online' | 'bot'
    let myRole = null;
    let currentRoom = null;
    let started = false;             // two players are in the room (always true against the computer)
    let turn = 'X';
    let winner = null;               // result of the CURRENT round: 'X' | 'O' | 'draw' | null
    let players = 0;
    let board = Array(9).fill('');
    let synced = false;              // false until the first room_update after joining
    let resultTimer = null;
    let connState = 'connecting';
    let botLevel = 'medium';
    let botTimer = null;
    let restartPending = false;      // I asked for a restart and wait for the answer
    let restartTimer = null;
    let incomingTimer = null;

    // match / rounds
    let phase = 'setup';             // setup | playing | round_over | match_over
    let rounds = 1;
    let round = 1;
    let scores = { X: 0, O: 0 };
    let starter = 'X';
    let champion = null;             // 'X' | 'O' | 'draw' once the match is over
    let readyRoles = [];
    let prevPhase = null;
    let botRoundsChoice = 1;
    let botMatchNo = 1;              // the player who opens each new match alternates
    let iCreated = false;            // I made this room (needed to re-create it after a connection drop)

    // nudge
    let nudgeUntil = 0;
    let nudgeTick = null;

    L.getRole = () => myRole;

    const isBot = () => mode === 'bot';
    const movesCount = () => board.filter(Boolean).length;
    const scoreTotal = () => scores.X + scores.O;
    // Something exists that a restart / leaving would throw away
    const matchStarted = () => movesCount() > 0 || scoreTotal() > 0 || round > 1;
    // A running game whose progress would be lost by leaving / refreshing
    const inActiveGame = () => (isBot()
        ? phase !== 'match_over' && matchStarted()
        : !!currentRoom && started && (phase === 'playing' || phase === 'round_over'));

    // ---------- Helpers ----------
    function modalOf(id) { return bootstrap.Modal.getOrCreateInstance($(id)); }
    function hideModal(id) {
        const m = bootstrap.Modal.getInstance($(id));
        if (m) m.hide();
    }

    function copyText(text) {
        const done = () => L.toast(L.t('copied'), 'success');
        const fail = () => L.toast(L.t('err_copy'), 'danger');

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(done, fail);
            return;
        }
        const ta = document.createElement('textarea');   // fallback for plain http
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        ta.remove();
        ok ? done() : fail();
    }

    function setConn(state) {
        connState = state;
        document.querySelectorAll('.conn-dot').forEach((d) => { d.dataset.state = state; });
        document.querySelectorAll('.conn-text').forEach((el) => { el.textContent = L.t('conn_' + state); });
    }

    function showGame() {
        game.classList.toggle('mode-bot', isBot());
        lobby.classList.add('d-none');
        game.classList.remove('d-none');
        document.body.classList.remove('in-lobby');
        window.scrollTo(0, 0);
    }

    function showLobby() {
        game.classList.add('d-none');
        lobby.classList.remove('d-none');
        document.body.classList.add('in-lobby');
        window.scrollTo(0, 0);
    }

    function resetBoard() {
        board = Array(9).fill('');
        cells.forEach((c, i) => {
            c.classList.remove('win');
            marks[i].className = 'mark';
        });
    }

    function resetMatchState(nextPhase) {
        phase = nextPhase;
        round = 1;
        scores = { X: 0, O: 0 };
        starter = 'X';
        champion = null;
        readyRoles = [];
        prevPhase = null;
    }

    // A confirmation dialog used for "restart" and "leave"
    function confirmDialog(titleKey, textKey, onOk) {
        $('confirmTitle').textContent = L.t(titleKey);
        $('confirmText').textContent = L.t(textKey);
        $('confirmOk').onclick = () => { hideModal('confirmModal'); onOk(); };
        modalOf('confirmModal').show();
    }

    // ---------- Rendering ----------
    function matchResultKey() {
        if (champion === 'draw') return 'statusDraw';
        return champion === myRole ? 'statusWin' : 'statusLose';
    }

    function statusKey() {
        if (!isBot() && !socket.connected) return 'statusDisconnected';
        if (!started) return 'statusWaiting';
        if (!isBot() && phase === 'setup') return 'statusSetup';
        if (phase === 'match_over') return matchResultKey();
        if (phase === 'round_over') {
            if (winner === 'draw') return 'statusRoundDraw';
            return winner === myRole ? 'statusRoundWon' : 'statusRoundLost';
        }
        if (turn === myRole) return 'statusYourTurn';
        return isBot() ? 'statusBotTurn' : 'statusOppTurn';
    }

    const TONES = {
        statusWin: 'success', statusLose: 'danger', statusDraw: 'warn',
        statusRoundWon: 'success', statusRoundLost: 'danger', statusRoundDraw: 'warn',
        statusYourTurn: 'accent', statusSetup: 'accent', statusDisconnected: 'danger'
    };

    function nameKeyFor(symbol) {
        if (symbol === myRole) return 'you';
        if (isBot()) return 'computer';
        return players === 2 ? 'opponent' : 'waitingShort';
    }

    function renderNudge() {
        const show = !isBot() && started && phase === 'playing' && !winner && turn !== myRole && socket.connected;
        $('nudgeWrap').classList.toggle('d-none', !show);
        const left = Math.ceil((nudgeUntil - Date.now()) / 1000);
        const cooling = left > 0;
        $('nudgeBtn').disabled = cooling;
        $('nudgeLabel').textContent = cooling ? L.t('nudgeWait', { s: left }) : L.t('nudge');
    }

    function render() {
        const key = statusKey();
        statusEl.textContent = L.t(key);
        statusEl.dataset.tone = TONES[key] || '';

        $('nameX').textContent = L.t(nameKeyFor('X'));
        $('nameO').textContent = L.t(nameKeyFor('O'));
        const linkOk = isBot() || socket.connected;
        const live = started && winner === null && phase === 'playing' && linkOk;
        $('chipX').classList.toggle('active', live && turn === 'X');
        $('chipO').classList.toggle('active', live && turn === 'O');

        // scoreboard (only for matches of 3 or 5 rounds)
        const showScore = rounds > 1 && started && phase !== 'setup';
        $('scoreBoard').classList.toggle('d-none', !showScore);
        $('roundNow').textContent = String(round);
        $('roundTotal').textContent = String(rounds);
        $('scoreX').textContent = String(scores.X);
        $('scoreO').textContent = String(scores.O);

        // setup panel: both players choose the rounds and press Ready
        const setup = !isBot() && started && phase === 'setup';
        $('setupPanel').classList.toggle('d-none', !setup);
        $('boardArea').classList.toggle('d-none', setup);
        if (setup) {
            document.querySelectorAll('#roundChips .round-chip').forEach((chip) => {
                chip.classList.toggle('active', parseInt(chip.dataset.rounds, 10) === rounds);
                chip.disabled = !socket.connected;
            });
            const iAmReady = readyRoles.indexOf(myRole) !== -1;
            const oppReady = readyRoles.indexOf(opp(myRole)) !== -1;
            $('readyBtn').disabled = iAmReady || !socket.connected;
            $('setupStatus').textContent = iAmReady ? L.t('setupWaitOpp') : (oppReady ? L.t('setupOppReady') : '');
        }

        const canPlay = live && turn === myRole && !(isBot() && botTimer);
        cells.forEach((cell, i) => {
            cell.disabled = !canPlay || !!board[i];
            cell.setAttribute('aria-label', L.t('cell', { n: i + 1 }) + (board[i] ? ' ' + board[i] : ''));
        });

        $('nextRoundWrap').classList.toggle('d-none', phase !== 'round_over' || !started);

        // Restart needs something to restart; online also needs a 2nd player and no pending request
        restartBtn.disabled = isBot()
            ? !matchStarted()
            : !(socket.connected && started && phase !== 'setup' && matchStarted() && !restartPending);

        // "Play vs computer instead" while nobody has joined the room yet
        $('botInsteadWrap').classList.toggle('d-none', isBot() || started || !currentRoom);

        renderNudge();
        setConn(connState);
    }

    // Only cells that changed are touched (minimal DOM work)
    function applyBoard(next, line) {
        let moved = false;
        for (let i = 0; i < 9; i++) {
            const value = next[i] || '';
            if (value !== board[i]) {
                marks[i].className = 'mark' + (value ? ' ' + value.toLowerCase() + ' pop' : '');
                if (value) moved = true;
            }
            cells[i].classList.toggle('win', line.indexOf(i) !== -1);
        }
        board = next.slice();
        return moved;
    }

    // ---------- Result dialogs (round result / match result) ----------
    function openResultLater(info) {
        clearTimeout(resultTimer);
        resultTimer = setTimeout(() => {
            $('resultEmoji').textContent = info.emoji;
            $('resultTitle').textContent = info.title;
            $('resultText').textContent = info.text;
            const score = $('resultScore');
            score.textContent = L.t('scoreLine', { x: scores.X, o: scores.O });
            score.classList.toggle('d-none', rounds <= 1);
            $('nextRoundBtn').classList.toggle('d-none', !info.nextRound);
            $('playAgainBtn').classList.toggle('d-none', !!info.nextRound);
            modalOf('resultModal').show();
        }, 600);   // a short pause so the player can see the final move first
    }

    function hideResult() {
        clearTimeout(resultTimer);
        hideModal('resultModal');
    }

    function nextStarterAfterRound() {
        return (winner === 'X' || winner === 'O') ? winner : opp(starter);
    }

    function roundEnded() {
        const kind = winner === 'draw' ? 'draw' : (winner === myRole ? 'win' : 'lose');
        if (kind === 'win') L.sfx('win'); else if (kind === 'draw') L.sfx('draw');

        const who = nextStarterAfterRound();
        const startLine = who === myRole ? L.t('youStartNext') : L.t(isBot() ? 'botStartsNext' : 'oppStartsNext');
        const T = {
            win: ['🎯', 'roundWinTitle', 'roundWinText'],
            lose: ['😕', 'roundLoseTitle', 'roundLoseText'],
            draw: ['🤝', 'roundDrawTitle', 'roundDrawText']
        }[kind];
        openResultLater({ emoji: T[0], title: L.t(T[1]), text: L.t(T[2]) + ' ' + startLine, nextRound: true });
    }

    function matchEnded() {
        const kind = champion === 'draw' ? 'draw' : (champion === myRole ? 'win' : 'lose');
        if (kind === 'win') L.sfx('win'); else if (kind === 'draw') L.sfx('draw');
        const T = {
            win: ['🏆', 'winTitle', 'winText'],
            lose: ['😢', 'loseTitle', 'loseText'],
            draw: ['🤝', 'drawTitle', 'drawText']
        }[kind];
        openResultLater({ emoji: T[0], title: L.t(T[1]), text: L.t(T[2]), nextRound: false });
    }

    // ======================= PLAY VS COMPUTER =======================
    function startBot(level, nRounds) {
        clearTimeout(botTimer); botTimer = null;
        mode = 'bot';
        botLevel = level;
        currentRoom = null;
        myRole = 'X';
        started = true;
        turn = 'X';
        winner = null;
        players = 2;
        rounds = nRounds || 1;
        botMatchNo = 1;
        resetMatchState('playing');
        resetBoard();
        hideResult();
        showGame();
        render();
    }

    // Same rules as the server: a drawn round gives no point; the match ends after the
    // last round, or earlier when nobody can catch up.
    function localRoundFinished(r) {
        winner = r.winner;
        applyBoard(board, r.line || []);
        if (winner === 'X' || winner === 'O') scores[winner] += 1;

        const remaining = rounds - round;
        const sx = scores.X, so = scores.O;
        if (remaining <= 0 || sx > so + remaining || so > sx + remaining) {
            phase = 'match_over';
            champion = sx > so ? 'X' : (so > sx ? 'O' : 'draw');
        } else {
            phase = 'round_over';
        }
        render();
        phase === 'match_over' ? matchEnded() : roundEnded();
    }

    function botMove() {
        botTimer = null;
        if (!isBot() || winner || phase !== 'playing') return;

        const idx = LOCOBot.bestMove(board, botLevel, 'O', 'X');
        if (idx < 0) return;
        board[idx] = 'O';
        marks[idx].className = 'mark o pop';
        L.sfx('move');

        const r = LOCOBot.result(board);
        if (r) {
            localRoundFinished(r);
        } else {
            turn = 'X';
            render();
        }
    }

    function humanMoveLocal(index) {
        if (!started || winner || phase !== 'playing' || turn !== 'X' || board[index] || botTimer) return;

        board[index] = 'X';
        marks[index].className = 'mark x pop';
        L.sfx('move');

        const r = LOCOBot.result(board);
        if (r) {
            localRoundFinished(r);
            return;
        }
        turn = 'O';
        botTimer = setTimeout(botMove, BOT_DELAY_MS);
        render();
    }

    function nextRoundLocal() {
        if (phase !== 'round_over') return;
        starter = nextStarterAfterRound();
        round += 1;
        phase = 'playing';
        winner = null;
        turn = starter;
        resetBoard();
        hideResult();
        render();
        if (starter === 'O') botTimer = setTimeout(botMove, BOT_DELAY_MS);   // the winner starts
    }

    function restartBot() {
        clearTimeout(botTimer); botTimer = null;
        started = true; winner = null;
        botMatchNo += 1;
        resetMatchState('playing');
        starter = botMatchNo % 2 === 0 ? 'O' : 'X';   // new match: the other side opens
        turn = starter;
        resetBoard();
        hideResult();
        render();
        if (starter === 'O') botTimer = setTimeout(botMove, BOT_DELAY_MS);
    }

    // ======================= ONLINE ROOMS =======================
    // create=true only for the "Create room" button (and when its creator reconnects);
    // typing a code can only JOIN an existing room.
    function joinOnServer(code) {
        synced = false;
        socket.emit('join_game', { code: code, create: iCreated });
    }

    function connectToRoom(code, create) {
        if (!socket.connected) {
            L.toast(L.t('err_not_connected'), 'danger');
            return;
        }
        mode = 'online';
        currentRoom = code;
        iCreated = !!create;
        joinOnServer(code);
    }

    function createRoom() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        roomInput.value = code;
        connectToRoom(code, true);
    }

    function joinRoom() {
        const code = roomInput.value.trim().toUpperCase();
        if (!code) {
            roomInput.classList.add('is-invalid');
            L.toast(L.t('err_enter_code'), 'danger');
            roomInput.focus();
            return;
        }
        connectToRoom(code, false);
    }

    function clearRestartState() {
        restartPending = false;
        clearTimeout(restartTimer);
        clearTimeout(incomingTimer);
        hideModal('restartModal');
    }

    function leaveEverything(emitLeave) {
        if (!isBot() && emitLeave !== false) socket.emit('leave_game');
        clearTimeout(botTimer); botTimer = null;
        clearRestartState();
        mode = 'online';
        currentRoom = null;
        myRole = null;
        started = false;
        winner = null;
        players = 0;
        rounds = 1;
        iCreated = false;
        nudgeUntil = 0;
        resetMatchState('setup');
        resetBoard();
        hideResult();
        const oc = bootstrap.Offcanvas.getInstance($('chatOffcanvas'));
        if (oc) oc.hide();
        if (L.chat) L.chat.reset();
        if (L.voice) L.voice.reset();
        roomInput.value = '';
        showLobby();
    }

    function backToLobby() {
        if (inActiveGame()) {
            confirmDialog('confirmLeaveTitle', isBot() ? 'confirmLeaveText' : 'confirmLeaveOnline', () => leaveEverything());
        } else {
            leaveEverything();
        }
    }

    // ---------- Restart (online needs the opponent's consent) ----------
    function sendRestartRequest() {
        socket.emit('restart_request');
        restartPending = true;
        L.toast(L.t('restartSent'));
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => { restartPending = false; render(); }, RESTART_WAIT_MS);
        hideResult();
        render();
    }

    function restartClicked() {
        if (!matchStarted()) return;

        const finished = phase === 'match_over';
        if (isBot()) {
            // a finished match restarts straight away; a running one needs confirmation
            finished ? restartBot() : confirmDialog('confirmRestartTitle', 'confirmRestartText', restartBot);
            return;
        }
        if (restartPending) return;

        if (finished) sendRestartRequest();
        else confirmDialog('confirmRestartTitle', 'confirmRestartOnline', sendRestartRequest);
    }

    function nextRoundClicked() {
        hideResult();
        if (isBot()) nextRoundLocal();
        else socket.emit('next_round');
    }

    // ---------- Nudge ----------
    function sendNudge() {
        if (Date.now() < nudgeUntil) return;
        socket.emit('nudge');
        L.toast(L.t('nudgeSent'));
        nudgeUntil = Date.now() + NUDGE_COOLDOWN_S * 1000;
        clearInterval(nudgeTick);
        nudgeTick = setInterval(() => {
            renderNudge();
            if (Date.now() >= nudgeUntil) clearInterval(nudgeTick);
        }, 500);
        renderNudge();
    }

    // ---------- Bot picker ----------
    function openBotPicker() { modalOf('botModal').show(); }

    document.querySelectorAll('#botRoundChips .round-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            botRoundsChoice = parseInt(chip.dataset.rounds, 10);
            document.querySelectorAll('#botRoundChips .round-chip').forEach((c) => {
                c.classList.toggle('active', c === chip);
            });
        });
    });

    document.querySelectorAll('.level-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const level = btn.dataset.level;
            hideModal('botModal');
            // Coming from a waiting room: leave it first
            if (currentRoom) { socket.emit('leave_game'); if (L.chat) L.chat.reset(); if (L.voice) L.voice.reset(); }
            clearRestartState();
            startBot(level, botRoundsChoice);
        });
    });

    // ---------- UI events ----------
    $('createBtn').addEventListener('click', createRoom);
    $('joinForm').addEventListener('submit', (e) => { e.preventDefault(); joinRoom(); });
    $('botBtn').addEventListener('click', openBotPicker);
    $('botInsteadBtn').addEventListener('click', openBotPicker);

    roomInput.addEventListener('input', () => {
        roomInput.value = roomInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        roomInput.classList.remove('is-invalid');
    });

    $('copyLobby').addEventListener('click', () => {
        const code = roomInput.value.trim();
        code ? copyText(code) : L.toast(L.t('err_nothing_copy'), 'danger');
    });
    $('copyRoom').addEventListener('click', () => { if (currentRoom) copyText(currentRoom); });

    boardEl.addEventListener('click', (e) => {
        const cell = e.target.closest('.cell');
        if (!cell || cell.disabled) return;
        const index = parseInt(cell.dataset.i, 10);

        if (isBot()) { humanMoveLocal(index); return; }

        // The server validates everything again; this only avoids useless traffic
        if (!started || winner || phase !== 'playing' || turn !== myRole || board[index]) return;
        socket.emit('make_move', { index: index });
    });

    // Match setup (online): choose rounds, then Ready
    $('roundChips').addEventListener('click', (e) => {
        const chip = e.target.closest('.round-chip');
        if (!chip || phase !== 'setup') return;
        socket.emit('match_config', { rounds: parseInt(chip.dataset.rounds, 10) });
    });
    $('readyBtn').addEventListener('click', () => {
        if (phase === 'setup') socket.emit('match_ready');
    });

    restartBtn.addEventListener('click', restartClicked);
    $('playAgainBtn').addEventListener('click', () => {
        hideResult();
        if (isBot()) restartBot();
        else if (!restartPending) sendRestartRequest();
    });
    $('nextRoundBtn').addEventListener('click', nextRoundClicked);
    $('nextRoundInline').addEventListener('click', nextRoundClicked);
    $('nudgeBtn').addEventListener('click', sendNudge);
    $('backBtn').addEventListener('click', backToLobby);

    // Opponent's answer to a restart request
    $('restartAccept').addEventListener('click', () => {
        clearTimeout(incomingTimer);
        socket.emit('restart_response', { accept: true });
        hideModal('restartModal');
    });
    $('restartDecline').addEventListener('click', () => {
        clearTimeout(incomingTimer);
        socket.emit('restart_response', { accept: false });
        hideModal('restartModal');
    });

    document.addEventListener('loco:lang', render);

    // Warn before refresh / closing the tab while a game is running
    // (browsers show their own standard text; a custom message is not allowed)
    window.addEventListener('beforeunload', (e) => {
        const call = L.voice && L.voice.active && L.voice.active();
        if (inActiveGame() || call) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) document.title = L.t('siteTitle');
    });

    // ---------- Socket events ----------
    socket.on('connect', () => {
        setConn('connected');
        // After a network drop the server forgot us: rejoin the same room
        if (!isBot() && currentRoom) joinOnServer(currentRoom);
        else render();
    });

    socket.on('disconnect', () => { setConn('disconnected'); render(); });
    socket.on('connect_error', () => { setConn('disconnected'); render(); });
    socket.io.on('reconnect_attempt', () => { setConn('connecting'); });

    socket.on('your_role', (data) => {
        if (isBot() || !currentRoom) return;      // late message after leaving the room
        myRole = data.role;
        $('roomCode').textContent = currentRoom;
        showGame();
        render();
    });

    socket.on('room_update', (data) => {
        if (isBot() || data.code !== currentRoom) return;

        const hadProgress = matchStarted();
        started = !!data.started;
        turn = data.turn;
        winner = data.winner || null;
        players = data.players;

        // match fields (an older server without rounds behaves like a single round)
        phase = data.phase || 'playing';
        rounds = data.rounds || 1;
        round = data.round || 1;
        scores = data.scores || { X: 0, O: 0 };
        starter = data.starter || 'X';
        champion = data.champion || null;
        readyRoles = data.ready || [];

        const moved = applyBoard(data.board, data.line || []);
        const firstSync = !synced;
        synced = true;

        if (!started) {
            clearRestartState();
        } else if (hadProgress && !matchStarted() && phase === 'playing' && !firstSync) {
            clearRestartState();                       // the restart was accepted
            L.toast(L.t('restartDone'), 'success');
        }
        render();

        if (phase === 'playing' || phase === 'setup') {
            hideResult();
            if (moved && !firstSync && phase === 'playing') L.sfx('move');
        }
        if (!firstSync) {
            if (phase === 'round_over' && prevPhase !== 'round_over') roundEnded();
            else if (phase === 'match_over' && prevPhase !== 'match_over') matchEnded();
        }
        prevPhase = phase;
    });

    // The opponent wants to restart: ask me
    socket.on('restart_requested', () => {
        if (isBot() || !currentRoom) return;
        hideResult();
        hideModal('confirmModal');
        modalOf('restartModal').show();
        L.sfx('message');
        clearTimeout(incomingTimer);
        incomingTimer = setTimeout(() => {          // no answer = decline
            socket.emit('restart_response', { accept: false });
            hideModal('restartModal');
        }, RESTART_WAIT_MS);
    });

    socket.on('restart_declined', () => {
        restartPending = false;
        clearTimeout(restartTimer);
        L.toast(L.t('restartDeclined'), 'danger');
        render();
    });

    // The opponent nudged me: it is my turn
    socket.on('nudged', () => {
        L.toast(L.t('nudgeIncoming'));
        L.sfx('nudge');
        if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
        boardEl.classList.remove('shake');
        void boardEl.offsetWidth;                  // restart the animation
        boardEl.classList.add('shake');
        if (document.hidden) document.title = L.t('nudgeIncoming');
    });

    socket.on('error_message', (data) => {
        const key = data && data.code ? 'err_' + data.code : '';
        const text = key && L.has(key) ? L.t(key) : (data && data.message) || L.t('err_generic');
        L.toast(text, 'danger');

        const code = data && data.code;
        if (code === 'room_not_found') {
            roomInput.classList.add('is-invalid');
            // We were inside this room and it is gone (e.g. after a connection drop): back to the lobby
            if (!game.classList.contains('d-none')) { leaveEverything(false); roomInput.classList.remove('is-invalid'); }
            else currentRoom = null;
        } else if ((code === 'room_full' || code === 'invalid_code') && game.classList.contains('d-none')) {
            // Join failed: stay in the lobby and forget the room
            currentRoom = null;
        }
    });

    setConn('connecting');
})();
