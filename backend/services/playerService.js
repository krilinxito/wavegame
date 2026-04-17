const cache = require('../cache/redis');

async function getPlayersForGame(gameId) {
  return cache.getPlayers(gameId);
}

async function updatePlayerSocket(gameId, playerId, socketId, connected = true) {
  const player = await cache.getPlayer(gameId, playerId);
  if (!player) return;
  player.socket_id = socketId;
  player.connected = connected;
  await cache.setPlayer(gameId, player);
}

async function updatePlayerScore(gameId, playerId, delta) {
  const player = await cache.getPlayer(gameId, playerId);
  if (!player) return;
  player.score = (player.score || 0) + delta;
  await cache.setPlayer(gameId, player);
}

async function getPlayer(gameId, playerId) {
  return cache.getPlayer(gameId, playerId);
}

module.exports = { getPlayersForGame, updatePlayerSocket, updatePlayerScore, getPlayer };
