/* LOCO — bot.js
   The computer opponent. Pure functions, no DOM, so it is easy to test.
   Levels: "easy" (random), "medium" (wins / blocks / sensible), "hard" (unbeatable). */
(function (root) {
    'use strict';

    var LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

    function result(board) {
        for (var i = 0; i < LINES.length; i++) {
            var a = LINES[i][0], b = LINES[i][1], c = LINES[i][2];
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return { winner: board[a], line: LINES[i] };
            }
        }
        if (board.indexOf('') === -1) return { winner: 'draw', line: [] };
        return null;
    }

    function emptyCells(board) {
        var out = [];
        for (var i = 0; i < 9; i++) if (!board[i]) out.push(i);
        return out;
    }

    function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

    // Cell that completes a line for `who`, or -1
    function findWin(board, who) {
        var cells = emptyCells(board);
        for (var i = 0; i < cells.length; i++) {
            board[cells[i]] = who;
            var r = result(board);
            board[cells[i]] = '';
            if (r && r.winner === who) return cells[i];
        }
        return -1;
    }

    // Minimax: score from the bot's point of view (+ good, - bad), faster wins score higher
    function minimax(board, turn, me, opp, depth) {
        var r = result(board);
        if (r) return r.winner === me ? 10 - depth : r.winner === opp ? depth - 10 : 0;

        var cells = emptyCells(board);
        var best = turn === me ? -Infinity : Infinity;
        for (var i = 0; i < cells.length; i++) {
            board[cells[i]] = turn;
            var score = minimax(board, turn === me ? opp : me, me, opp, depth + 1);
            board[cells[i]] = '';
            best = turn === me ? Math.max(best, score) : Math.min(best, score);
        }
        return best;
    }

    function hardMove(board, me, opp) {
        var cells = emptyCells(board);
        if (cells.length === 9) return pick([0, 2, 4, 6, 8]);   // any corner/centre is fine; adds variety

        var bestScore = -Infinity, bestCells = [];
        for (var i = 0; i < cells.length; i++) {
            board[cells[i]] = me;
            var score = minimax(board, opp, me, opp, 1);
            board[cells[i]] = '';
            if (score > bestScore) { bestScore = score; bestCells = [cells[i]]; }
            else if (score === bestScore) bestCells.push(cells[i]);
        }
        return pick(bestCells);
    }

    function mediumMove(board, me, opp) {
        var w = findWin(board, me);
        if (w !== -1) return w;
        var b = findWin(board, opp);
        if (b !== -1) return b;
        if (!board[4]) return 4;
        var corners = [0, 2, 6, 8].filter(function (i) { return !board[i]; });
        if (corners.length && Math.random() < 0.7) return pick(corners);
        return pick(emptyCells(board));
    }

    /** Returns the index the bot wants to play, or -1 if the board is full. */
    function bestMove(board, level, me, opp) {
        var copy = board.slice();
        if (!emptyCells(copy).length) return -1;
        if (level === 'hard') return hardMove(copy, me, opp);
        if (level === 'medium') return mediumMove(copy, me, opp);
        return pick(emptyCells(copy));
    }

    var api = { bestMove: bestMove, result: result };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.LOCOBot = api;
})(typeof window !== 'undefined' ? window : this);
