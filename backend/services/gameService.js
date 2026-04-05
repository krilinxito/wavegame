const pool = require('../db');
const { getPlayersForGame } = require('./playerService');

async function getGame(gameId) {
  const [rows] = await pool.execute('SELECT * FROM games WHERE id = ?', [gameId]);
  return rows[0] || null;
}

async function getGameByCode(code) {
  const [rows] = await pool.execute('SELECT * FROM games WHERE room_code = ?', [code.toUpperCase()]);
  return rows[0] || null;
}

async function updateGameConfig(gameId, { mode, range_min, range_max, win_condition, win_value, guess_time }) {
  await pool.execute(
    'UPDATE games SET mode=?, range_min=?, range_max=?, win_condition=?, win_value=?, guess_time=? WHERE id=?',
    [mode, range_min, range_max, win_condition, win_value, guess_time ?? 120, gameId]
  );
}

async function startGame(gameId) {
  await pool.execute("UPDATE games SET status='playing' WHERE id=?", [gameId]);
}

async function rotatePsychic(gameId) {
  const game = await getGame(gameId);
  const players = await getPlayersForGame(gameId);
  const activePlayers = players.filter(p => p.connected);
  if (!activePlayers.length) return null;

  let nextPsychic;
  if (!game.psychic_id) {
    nextPsychic = activePlayers[0];
  } else {
    const currentIdx = activePlayers.findIndex(p => p.id === game.psychic_id);
    nextPsychic = activePlayers[(currentIdx + 1) % activePlayers.length];
  }

  await pool.execute(
    'UPDATE games SET psychic_id=?, current_round=current_round+1 WHERE id=?',
    [nextPsychic.id, gameId]
  );

  return nextPsychic;
}

/**
 * Check if win condition is met.
 * Returns { won: true, winner: player|team } or { won: false }
 */
async function checkWinCondition(gameId) {
  const game = await getGame(gameId);
  const players = await getPlayersForGame(gameId);

  if (game.win_condition === 'points') {
    const winner = players.find(p => p.score >= game.win_value);
    if (winner) {
      await pool.execute("UPDATE games SET status='finished' WHERE id=?", [gameId]);
      return { won: true, winner, type: 'points' };
    }
  } else if (game.win_condition === 'rounds') {
    if (game.current_round >= game.win_value) {
      const sorted = [...players].sort((a, b) => b.score - a.score);
      const winner = sorted[0];
      await pool.execute("UPDATE games SET status='finished' WHERE id=?", [gameId]);
      return { won: true, winner, type: 'rounds' };
    }
  }

  return { won: false };
}

module.exports = { getGame, getGameByCode, updateGameConfig, startGame, rotatePsychic, checkWinCondition };
