const pool = require('../db');

async function getPlayersForGame(gameId) {
  const [rows] = await pool.execute(
    'SELECT * FROM players WHERE game_id = ? ORDER BY turn_order ASC',
    [gameId]
  );
  return rows;
}

async function updatePlayerSocket(playerId, socketId, connected = true) {
  await pool.execute(
    'UPDATE players SET socket_id = ?, connected = ? WHERE id = ?',
    [socketId, connected, playerId]
  );
}

async function updatePlayerScore(playerId, delta) {
  await pool.execute(
    'UPDATE players SET score = score + ? WHERE id = ?',
    [delta, playerId]
  );
}

async function getPlayer(playerId) {
  const [rows] = await pool.execute('SELECT * FROM players WHERE id = ?', [playerId]);
  return rows[0] || null;
}

module.exports = { getPlayersForGame, updatePlayerSocket, updatePlayerScore, getPlayer };
