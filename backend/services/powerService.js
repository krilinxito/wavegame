const uuidv4 = () => require('crypto').randomUUID();
const pool = require('../db');

const POWER_IDS = [1, 2, 3, 4, 5]; // cuartiles, veneno, escudo, bloqueo, switch

/**
 * Assign one random power to each player for this round.
 * In teams mode, no powers are assigned.
 */
async function offerPowers(roundId, playerIds, mode) {
  if (mode === 'teams') return {};

  const [powers] = await pool.execute('SELECT * FROM powers');
  const offers = {};

  for (const playerId of playerIds) {
    const power = powers[Math.floor(Math.random() * powers.length)];
    const id = uuidv4();
    await pool.execute(
      'INSERT INTO round_powers (id, round_id, player_id, power_id) VALUES (?, ?, ?, ?)',
      [id, roundId, playerId, power.id]
    );
    offers[playerId] = { roundPowerId: id, power };
  }

  return offers; // { playerId → { roundPowerId, power } }
}

/**
 * Activate a power. Returns the effect payload to broadcast.
 * Deducts cost from player.score.
 */
async function activatePower(roundPowerId, playerId, targetPlayerId = null) {
  const [rows] = await pool.execute(
    `SELECT rp.*, p.name, p.cost, p.description
     FROM round_powers rp JOIN powers p ON rp.power_id = p.id
     WHERE rp.id = ? AND rp.player_id = ?`,
    [roundPowerId, playerId]
  );

  if (!rows.length) throw new Error('Power not found');
  const rp = rows[0];
  if (rp.activated) throw new Error('Power already used');

  // Check player has enough points
  const [playerRows] = await pool.execute('SELECT score FROM players WHERE id=?', [playerId]);
  if (!playerRows.length) throw new Error('Player not found');
  if (playerRows[0].score < rp.cost) throw new Error('INSUFFICIENT_POINTS');

  // Deduct cost
  await pool.execute('UPDATE players SET score = score - ? WHERE id=?', [rp.cost, playerId]);

  // Mark activated
  await pool.execute(
    'UPDATE round_powers SET activated=TRUE, target_player=?, activated_at=NOW() WHERE id=?',
    [targetPlayerId, roundPowerId]
  );

  return {
    powerName: rp.name,
    cost: rp.cost,
    targetPlayerId,
  };
}

/**
 * Get all active (activated) powers for a round.
 * Returns array of { powerName, activatorId, targetId }
 */
async function getActivePowers(roundId) {
  const [rows] = await pool.execute(
    `SELECT rp.player_id as activatorId, rp.target_player as targetId, p.name as powerName
     FROM round_powers rp JOIN powers p ON rp.power_id = p.id
     WHERE rp.round_id=? AND rp.activated=TRUE`,
    [roundId]
  );
  return rows;
}

module.exports = { offerPowers, activatePower, getActivePowers };
