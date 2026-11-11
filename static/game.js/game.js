/* LOCO — game.js
   Socket.IO connection, lobby, room flow, board and game status.
   Server events are the same ones your original game used:
   join_game, your_role, room_update, make_move, restart_game, error_message
   New: leave_game (back to lobby without reloading, so music keeps playing). */
(function () {
    'use strict';

    const L = window.LOCO;
    const $ = (id) => document.getElementById(id);

    // ONE socket for the whole page; chat.js reuses it (no duplicate listeners)
    const socket = L.socket = io();

    const lobby = $('lobby');
    const game = $('game');
    const roomInput = $('roomInput');
    const boardEl = $('board');
    const cells = Array.from(boardEl.querySelectorAll('.cell'));
    const marks = cells.map((c) => c.firstElementChild);
    const statusEl = $('status');
    const restartBtn = $('restartBtn');

    // ---------- State ----------
    let myRole = null;
    let currentRoom = null;
    let started = false;
    let turn = 'X';
    let winner = null;
    let players = 0;
    let board = Array(9).fill('');
    let synced = false;        // false until the first room_update after joining
    let resultTimer = null;
    let connState = 'connecting';

    L.getRole = () => myRole;

    // ---------- Helpers ----------
    function copyText(text) {
        const done = () => L.toast(L.t('copied'), 'success');
        const fail = () => L.toast(L.t('err_copy'), 'danger');

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(done, fail);
            return;
        }
        // Fallback for plain http (e.g. testing on your phone over Wi-Fi)
        const ta = document.createElement('textarea');
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

    // ---------- Rendering ----------
    function statusKey() {
        if (!socket.connected) return 'statusDisconnected';
        if (!started) return 'statusWaiting';
        if (winner === 'draw') return 'statusDraw';
        if (winner) return winner === myRole ? 'statusWin' : 'statusLose';
        return turn === myRole ? 'statusYourTurn' : 'statusOppTurn';
    }

    const TONES = {
        statusWin: 'success', statusLose: 'danger', statusDraw: 'warn',
        statusYourTurn: 'accent', statusDisconnected: 'danger'
    };

    function nameFor(symbol) {
        if (symbol === myRole) return L.t('you');
        return players === 2 ? L.t('opponent') : L.t('waitingShort');
    }

    function render() {
        const key = statusKey();
        statusEl.textContent = L.t(key);
        statusEl.dataset.tone = TONES[key] || '';

        $('nameX').textContent = nameFor('X');
        $('nameO').textContent = nameFor('O');
        const live = started && !winner && socket.connected;
        $('chipX').classList.toggle('active', live && turn === 'X');
        $('chipO').classList.toggle('active', live && turn === 'O');

        const canPlay = live && turn === myRole;
        cells.forEach((cell, i) => {
            cell.disabled = !canPlay || !!board[i];
            cell.setAttribute('aria-label', L.t('cell', { n: i + 1 }) + (board[i] ? ' ' + board[i] : ''));
        });

        restartBtn.disabled = !(socket.connected && started);
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
            bootstrap.Modal.getOrCreateInstance($('resultModal')).show();
        }, 600);   // short pause so the player can see the final move first
    }

    function hideResult() {
        clearTimeout(resultTimer);
        const modal = bootstrap.Modal.getInstance($('resultModal'));
        if (modal) modal.hide();
    }

    // ---------- Room flow ----------
    function joinOnServer(code) {
        synced = false;
        socket.emit('join_game', { code: code });
    }

    function connectToRoom(code) {
        if (!socket.connected) {
            L.toast(L.t('err_not_connected'), 'danger');
            return;
        }
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

    function backToLobby() {
        socket.emit('leave_game');
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

    // ---------- UI events ----------
    $('createBtn').addEventListener('click', createRoom);
    $('joinForm').addEventListener('submit', (e) => { e.preventDefault(); joinRoom(); });

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
        // The server validates everything again; this only avoids useless traffic
        if (!started || winner || turn !== myRole || board[index]) return;
        socket.emit('make_move', { index: index });
    });

    restartBtn.addEventListener('click', () => socket.emit('restart_game'));
    $('playAgainBtn').addEventListener('click', () => {
        socket.emit('restart_game');
        hideResult();
    });
    $('backBtn').addEventListener('click', backToLobby);

    document.addEventListener('loco:lang', render);

    // ---------- Socket events ----------
    socket.on('connect', () => {
        setConn('connected');
        // After a network drop the server forgot us: rejoin the same room
        if (currentRoom) joinOnServer(currentRoom);
        else render();
    });

    socket.on('disconnect', () => { setConn('disconnected'); render(); });
    socket.on('connect_error', () => { setConn('disconnected'); render(); });
    socket.io.on('reconnect_attempt', () => { setConn('connecting'); });

    socket.on('your_role', (data) => {
        if (!currentRoom) return;      // late message after leaving the room
        myRole = data.role;
        $('roomCode').textContent = currentRoom;
        showGame();
        render();
    });

    socket.on('room_update', (data) => {
        if (data.code !== currentRoom) return;

        const previousWinner = winner;
        started = !!data.started;
        turn = data.turn;
        winner = data.winner || null;
        players = data.players;

        const moved = applyBoard(data.board, data.line || []);
        render();

        const firstSync = !synced;
        synced = true;

        if (!winner) {
            hideResult();
            if (moved && !firstSync) L.sfx('move');
        } else if (winner !== previousWinner && !firstSync) {
            if (winner === 'draw') {
                L.sfx('draw');
                showResultLater('draw');
            } else if (winner === myRole) {
                L.sfx('win');
                showResultLater('win');
            } else {
                showResultLater('lose');
            }
        }
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
