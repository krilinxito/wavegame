require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Redis = require('ioredis');

function createClient() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  try {
    const parsed = new URL(url);
    const opts = {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 6379,
    };
    if (parsed.password) opts.password = decodeURIComponent(parsed.password);
    if (parsed.username) opts.username = decodeURIComponent(parsed.username);
    return new Redis(opts);
  } catch {
    return new Redis(url);
  }
}

const client = createClient();

client.on('error', (err) => console.error('Redis error:', err));

// --- Game ---
async function getGame(gameId) {
  const data = await client.get(`game:${gameId}`);
  return data ? JSON.parse(data) : null;
}
async function setGame(game) {
  await client.set(`game:${game.id}`, JSON.stringify(game));
}

// --- Room code → gameId ---
async function getRoomGameId(roomCode) {
  return client.get(`room:${roomCode.toUpperCase()}`);
}
async function setRoom(roomCode, gameId) {
  await client.set(`room:${roomCode.toUpperCase()}`, gameId);
}

// --- Players ---
async function getPlayer(gameId, playerId) {
  const data = await client.hget(`players:${gameId}`, playerId);
  return data ? JSON.parse(data) : null;
}
async function getPlayers(gameId) {
  const hash = await client.hgetall(`players:${gameId}`);
  if (!hash) return [];
  return Object.values(hash).map(v => JSON.parse(v)).sort((a, b) => a.turn_order - b.turn_order);
}
async function setPlayer(gameId, player) {
  await client.hset(`players:${gameId}`, player.id, JSON.stringify(player));
}

// --- Categories ---
async function getCategory(gameId, categoryId) {
  const data = await client.hget(`categories:${gameId}`, categoryId);
  return data ? JSON.parse(data) : null;
}
async function getCategories(gameId) {
  const hash = await client.hgetall(`categories:${gameId}`);
  if (!hash) return [];
  return Object.values(hash).map(v => JSON.parse(v)).sort((a, b) => a.created_at - b.created_at);
}
async function setCategory(gameId, cat) {
  await client.hset(`categories:${gameId}`, cat.id, JSON.stringify(cat));
}
async function deleteCategory(gameId, categoryId) {
  await client.hdel(`categories:${gameId}`, categoryId);
}

// --- Rounds ---
async function getRound(roundId) {
  const data = await client.get(`round:${roundId}`);
  return data ? JSON.parse(data) : null;
}
async function setRound(round) {
  await client.set(`round:${round.id}`, JSON.stringify(round));
  await client.sadd(`rounds:${round.game_id}`, round.id);
}
async function getRoundsForGame(gameId) {
  const ids = await client.smembers(`rounds:${gameId}`);
  if (!ids.length) return [];
  const rounds = await Promise.all(ids.map(id => getRound(id)));
  return rounds.filter(Boolean);
}

// --- Round Powers ---
// Indexed by playerId for fast lookup per player, + pointer by roundPowerId
async function getRoundPowerByPlayer(roundId, playerId) {
  const data = await client.hget(`round_powers:${roundId}`, playerId);
  return data ? JSON.parse(data) : null;
}
async function getRoundPowers(roundId) {
  const hash = await client.hgetall(`round_powers:${roundId}`);
  if (!hash) return [];
  return Object.values(hash).map(v => JSON.parse(v));
}
async function getRoundPowerById(roundPowerId) {
  const ptr = await client.get(`rp:${roundPowerId}`);
  if (!ptr) return null;
  const sep = ptr.indexOf(':');
  const roundId = ptr.substring(0, sep);
  const playerId = ptr.substring(sep + 1);
  return getRoundPowerByPlayer(roundId, playerId);
}
async function setRoundPower(roundId, rp) {
  await client.hset(`round_powers:${roundId}`, rp.player_id, JSON.stringify(rp));
  await client.set(`rp:${rp.id}`, `${roundId}:${rp.player_id}`);
  await client.sadd(`rp_ids:${roundId}`, rp.id);
}

// --- Guesses ---
async function getGuess(roundId, playerId) {
  const data = await client.hget(`guesses:${roundId}`, playerId);
  return data ? JSON.parse(data) : null;
}
async function getGuesses(roundId) {
  const hash = await client.hgetall(`guesses:${roundId}`);
  if (!hash) return [];
  return Object.values(hash).map(v => JSON.parse(v)).sort((a, b) => a.submitted_at - b.submitted_at);
}
async function setGuess(roundId, guess) {
  await client.hset(`guesses:${roundId}`, guess.player_id, JSON.stringify(guess));
}

// --- Cleanup: delete all data for a game ---
async function cleanupGame(gameId, roomCode) {
  const roundIds = await client.smembers(`rounds:${gameId}`);
  const keysToDelete = [
    `game:${gameId}`, `room:${roomCode.toUpperCase()}`,
    `players:${gameId}`, `categories:${gameId}`,
    `rounds:${gameId}`,
  ];

  for (const roundId of roundIds) {
    keysToDelete.push(`round:${roundId}`, `round_powers:${roundId}`, `guesses:${roundId}`);
    const rpIds = await client.smembers(`rp_ids:${roundId}`);
    for (const rpId of rpIds) keysToDelete.push(`rp:${rpId}`);
    keysToDelete.push(`rp_ids:${roundId}`);
  }

  if (keysToDelete.length) await client.del(...keysToDelete);
}

// --- Cleanup rounds only (for return_to_lobby) ---
async function cleanupRounds(gameId) {
  const roundIds = await client.smembers(`rounds:${gameId}`);
  const keysToDelete = [`rounds:${gameId}`];

  for (const roundId of roundIds) {
    keysToDelete.push(`round:${roundId}`, `round_powers:${roundId}`, `guesses:${roundId}`);
    const rpIds = await client.smembers(`rp_ids:${roundId}`);
    for (const rpId of rpIds) keysToDelete.push(`rp:${rpId}`);
    keysToDelete.push(`rp_ids:${roundId}`);
  }

  if (keysToDelete.length) await client.del(...keysToDelete);
}

module.exports = {
  client,
  getGame, setGame,
  getRoomGameId, setRoom,
  getPlayer, getPlayers, setPlayer,
  getCategory, getCategories, setCategory, deleteCategory,
  getRound, setRound, getRoundsForGame,
  getRoundPowerByPlayer, getRoundPowers, getRoundPowerById, setRoundPower,
  getGuess, getGuesses, setGuess,
  cleanupGame, cleanupRounds,
};
