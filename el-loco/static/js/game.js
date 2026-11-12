/* LOCO — game.js
   Socket.IO connection, lobby, online rooms, play-vs-computer mode, board,
   confirmations (restart / leave) and the "you will lose your progress" warning.
   Server events: join_game, your_role, room_update, make_move, leave_game,
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

    // ---------- State ----------
    let mode = 'online';             // 'online' | 'bot'
    let myRole = null;
    let currentRoom = null;
    let started = false;
    let turn = 'X';
    let winner = null;
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

    L.getRole = () => myRole;

    const isBot = () => mode === 'bot';
    const movesCount = () => board.filter(Boolean).length;
    // A game whose progress would be lost by leaving / refreshing
    const inActiveGame = () => (isBot()
        ? !winner && movesCount() > 0
        : !!currentRoom && started && !winner);

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

    // A confirmation dialog used for "restart" and "leave"
    function confirmDialog(titleKey, textKey, onOk) {
        $('confirmTitle').textContent = L.t(titleKey);
        $('confirmText').textContent = L.t(textKey);
        const ok = $('confirmOk');
        ok.onclick = () => { hideModal('confirmModal'); onOk(); };
        modalOf('confirmModal').show();
    }

    // ---------- Rendering ----------
    function statusKey() {
        if (!isBot() && !socket.connected) return 'statusDisconnected';
        if (!started) return 'statusWaiting';
        if (winner === 'draw') return 'statusDraw';
        if (winner) return winner === myRole ? 'statusWin' : 'statusLose';
        if (turn === myRole) return 'statusYourTurn';
        return isBot() ? 'statusBotTurn' : 'statusOppTurn';
    }

    const TONES = {
        statusWin: 'success', statusLose: 'danger', statusDraw: 'warn',
        statusYourTurn: 'accent', statusDisconnected: 'danger'
    };

    function nameFor(symbol) {
        if (symbol === myRole) return L.t('you');
        if (isBot()) return L.t('computer');
        return players === 2 ? L.t('opponent') : L.t('waitingShort');
    }

    function render() {
        const key = statusKey();
        statusEl.textContent = L.t(key);
        statusEl.dataset.tone = TONES[key] || '';

        $('nameX').textContent = nameFor('X');
        $('nameO').textContent = nameFor('O');
        const linkOk = isBot() || socket.connected;
        const live = started && !winner && linkOk;
        $('chipX').classList.toggle('active', live && turn === 'X');
        $('chipO').classList.toggle('active', live && turn === 'O');

        const canPlay = live && turn === myRole && !(isBot() && botTimer);
        cells.forEach((cell, i) => {
            cell.disabled = !canPlay || !!board[i];
            cell.setAttribute('aria-label', L.t('cell', { n: i + 1 }) + (board[i] ? ' ' + board[i] : ''));
        });

        // Restart: needs something to restart; online also needs a 2nd player and no pending request
        restartBtn.disabled = isBot()
            ? movesCount() === 0
            : !(socket.connected && started && movesCount() > 0 && !restartPending);

        // "Play vs computer instead" while nobody has joined the room yet
        $('botInsteadWrap').classList.toggle('d-none', isBot() || started || !currentRoom);

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

    // ---------- Result modal ----------
    const RESULTS = {
        win: ['🏆', 'winTitle', 'winText'],
        lose: ['😢', 'loseTitle', 'loseText'],
        draw: ['🤝', 'drawTitle', 'drawText']
    };

    function showResultLater(kind) {
        clearTimeout(resultTimer);
        resultTimer = setTimeout(() => {
            const r = RESULTS[kind];
            $('resultEmoji').textContent = r[0];
            $('resultTitle').textContent = L.t(r[1]);
            $('resultText').textContent = L.t(r[2]);
            modalOf('resultModal').show();
        }, 600);   // a short pause so the player can see the final move first
    }

    function hideResult() {
        clearTimeout(resultTimer);
        hideModal('resultModal');
    }

    function announceFinish() {
        if (winner === 'draw') { L.sfx('draw'); showResultLater('draw'); }
        else if (winner === myRole) { L.sfx('win'); showResultLater('win'); }
        else showResultLater('lose');
    }

    // ======================= PLAY VS COMPUTER =======================
    function startBot(level) {
        clearTimeout(botTimer); botTimer = null;
        mode = 'bot';
        botLevel = level;
        currentRoom = null;
        myRole = 'X';
        started = true;
        turn = 'X';
        winner = null;
        players = 2;
        resetBoard();
        hideResult();
        showGame();
        render();
    }

    function localFinish(line) {
        applyBoard(board, line || []);
        render();
        announceFinish();
    }

    function botMove() {
        botTimer = null;
        if (!isBot() || winner) return;

        const idx = LOCOBot.bestMove(board, botLevel, 'O', 'X');
        if (idx < 0) return;
        board[idx] = 'O';
        marks[idx].className = 'mark o pop';
        L.sfx('move');

        const r = LOCOBot.result(board);
        if (r) {
            winner = r.winner;
            localFinish(r.line);
        } else {
            turn = 'X';
            render();
        }
    }

    function humanMoveLocal(index) {
        if (!started || winner || turn !== 'X' || board[index] || botTimer) return;

        board[index] = 'X';
        marks[index].className = 'mark x pop';
        L.sfx('move');

        const r = LOCOBot.result(board);
        if (r) {
            winner = r.winner;
            localFinish(r.line);
            return;
        }
        turn = 'O';
        botTimer = setTimeout(botMove, BOT_DELAY_MS);
        render();
    }

    function restartBot() {
        clearTimeout(botTimer); botTimer = null;
        started = true; turn = 'X'; winner = null;
        resetBoard();
        hideResult();
        render();
    }

    // ======================= ONLINE ROOMS =======================
    function joinOnServer(code) {
        synced = false;
        socket.emit('join_game', { code: code });
    }

    function connectToRoom(code) {
        if (!socket.connected) {
            L.toast(L.t('err_not_connected'), 'danger');
            return;
        }
        mode = 'online';
        currentRoom = code;
        joinOnServer(code);
    }

    function createRoom() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        roomInput.value = code;
        connectToRoom(code);
    }

    function joinRoom() {
        const code = roomInput.value.trim().toUpperCase();
        if (!code) {
            roomInput.classList.add('is-invalid');
            L.toast(L.t('err_enter_code'), 'danger');
            roomInput.focus();
            return;
        }
        connectToRoom(code);
    }

    function clearRestartState() {
        restartPending = false;
        clearTimeout(restartTimer);
        clearTimeout(incomingTimer);
        hideModal('restartModal');
    }

    function leaveEverything() {
        if (!isBot()) socket.emit('leave_game');
        clearTimeout(botTimer); botTimer = null;
        clearRestartState();
        mode = 'online';
        currentRoom = null;
        myRole = null;
        started = false;
        winner = null;
        players = 0;
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
            confirmDialog('confirmLeaveTitle', isBot() ? 'confirmLeaveText' : 'confirmLeaveOnline', leaveEverything);
        } else {
            leaveEverything();
        }
    }

    // ---------- Restart ----------
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
        if (movesCount() === 0) return;

        if (isBot()) {
            // A finished game can be restarted straight away; a running one needs confirmation
            winner ? restartBot() : confirmDialog('confirmRestartTitle', 'confirmRestartText', restartBot);
            return;
        }
        if (restartPending) return;

        if (winner) sendRestartRequest();
        else confirmDialog('confirmRestartTitle', 'confirmRestartOnline', sendRestartRequest);
    }

    // ---------- Bot picker ----------
    function openBotPicker() { modalOf('botModal').show(); }

    document.querySelectorAll('.level-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const level = btn.dataset.level;
            hideModal('botModal');
            // Coming from a waiting room: leave it first
            if (currentRoom) { socket.emit('leave_game'); if (L.chat) L.chat.reset(); if (L.voice) L.voice.reset(); }
            clearRestartState();
            startBot(level);
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
        if (!started || winner || turn !== myRole || board[index]) return;
        socket.emit('make_move', { index: index });
    });

    restartBtn.addEventListener('click', restartClicked);
    $('playAgainBtn').addEventListener('click', () => {
        hideResult();
        if (isBot()) restartBot();
        else if (!restartPending) sendRestartRequest();
    });
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

        const previousWinner = winner;
        started = !!data.started;
        turn = data.turn;
        winner = data.winner || null;
        players = data.players;

        const hadMoves = movesCount() > 0;
        const moved = applyBoard(data.board, data.line || []);
        const firstSync = !synced;
        synced = true;

        if (!started) clearRestartState();
        else if (hadMoves && movesCount() === 0 && !firstSync) {
            clearRestartState();                       // the restart was accepted
            L.toast(L.t('restartDone'), 'success');
        }
        render();

        if (!winner) {
            hideResult();
            if (moved && !firstSync) L.sfx('move');
        } else if (winner !== previousWinner && !firstSync) {
            announceFinish();
        }
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

    socket.on('error_message', (data) => {
        const key = data && data.code ? 'err_' + data.code : '';
        const text = key && L.has(key) ? L.t(key) : (data && data.message) || L.t('err_generic');
        L.toast(text, 'danger');

        // Join failed: stay in the lobby and forget the room
        if (data && (data.code === 'room_full' || data.code === 'invalid_code') && game.classList.contains('d-none')) {
            currentRoom = null;
        }
    });

    setConn('connecting');
})();
