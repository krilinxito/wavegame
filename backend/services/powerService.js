const uuidv4 = () => require('crypto').randomUUID();
const pool = require('../db');

const POWER_IDS = [1, 2, 3, 4, 5]; // cuartiles, veneno, escudo, bloqueo, switch

/**
 * Assign one random power to each player for this round.
 * In teams mode, no powers are assigned.
 */
async function offerPowers(roundId, playerIds, mode, guaranteedIds = new Set()) {
  if (mode === 'teams') return {};

  const [powers] = await pool.execute('SELECT * FROM powers');
  const offers = {};

  for (const playerId of playerIds) {
    const isFree = guaranteedIds.has(playerId);
    // 25% chance of no power — skipped if player got bullseye last round
    if (!isFree && Math.random() < 0.25) {
      offers[playerId] = { roundPowerId: null, power: null, isFree: false };
      continue;
    }
    const power = powers[Math.floor(Math.random() * powers.length)];
    const id = uuidv4();
    await pool.execute(
      'INSERT INTO round_powers (id, round_id, player_id, power_id) VALUES (?, ?, ?, ?)',
      [id, roundId, playerId, power.id]
    );
    offers[playerId] = { roundPowerId: id, power, isFree };
  }

  return offers; // { playerId → { roundPowerId, power } }
}

/**
 * Check if a power of the same type is already active or queued in this round.
 * Throws POWER_TYPE_ALREADY_USED if conflict found.
 */
async function checkPowerTypeConflict(roundId, powerIdToCheck) {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) as cnt FROM round_powers WHERE round_id=? AND power_id=? AND (activated=TRUE OR queued=TRUE)',
    [roundId, powerIdToCheck]
  );
  if (rows[0].cnt > 0) throw new Error('POWER_TYPE_ALREADY_USED');
}

/**
 * Purchase a power (pay cost, store in inventory). Effect is NOT applied yet.
 */
async function purchasePower(roundPowerId, playerId, isFree = false) {
  const [rows] = await pool.execute(
    `SELECT rp.*, p.name, p.cost FROM round_powers rp JOIN powers p ON rp.power_id = p.id
     WHERE rp.id = ? AND rp.player_id = ?`,
    [roundPowerId, playerId]
  );

  if (!rows.length) throw new Error('Power not found');
  const rp = rows[0];
  if (rp.activated || rp.queued) throw new Error('Power already used');
  if (rp.purchased) throw new Error('Power already purchased');

  if (!isFree) {
    const [playerRows] = await pool.execute('SELECT score FROM players WHERE id=?', [playerId]);
    if (!playerRows.length) throw new Error('Player not found');
    if (playerRows[0].score < rp.cost) throw new Error('INSUFFICIENT_POINTS');
    await pool.execute('UPDATE players SET score = score - ? WHERE id=?', [rp.cost, playerId]);
  }

  await pool.execute('UPDATE round_powers SET purchased=TRUE WHERE id=?', [roundPowerId]);

  return { powerName: rp.name, cost: rp.cost };
}

/**
 * Queue a power during clue_giving phase.
 * If already purchased, skips cost deduction.
 * Effect is applied when guessing phase starts.
 */
async function queuePower(roundPowerId, playerId, targetPlayerId = null, isFree = false) {
  const [rows] = await pool.execute(
    `SELECT rp.*, p.name, p.cost, p.description
     FROM round_powers rp JOIN powers p ON rp.power_id = p.id
     WHERE rp.id = ? AND rp.player_id = ?`,
    [roundPowerId, playerId]
  );

  if (!rows.length) throw new Error('Power not found');
  const rp = rows[0];
  if (rp.activated) throw new Error('Power already used');
  if (rp.queued) throw new Error('Power already queued');

  // Anti-stacking: only one activation per power type per round
  await checkPowerTypeConflict(rp.round_id, rp.power_id);

  // Deduct cost only if not already purchased
  if (!isFree && !rp.purchased) {
    const [playerRows] = await pool.execute('SELECT score FROM players WHERE id=?', [playerId]);
    if (!playerRows.length) throw new Error('Player not found');
    if (playerRows[0].score < rp.cost) throw new Error('INSUFFICIENT_POINTS');
    await pool.execute('UPDATE players SET score = score - ? WHERE id=?', [rp.cost, playerId]);
  }

  await pool.execute(
    'UPDATE round_powers SET queued=TRUE, target_player=? WHERE id=?',
    [targetPlayerId, roundPowerId]
  );

  return { powerName: rp.name, cost: rp.cost, targetPlayerId };
}

/**
 * Get all queued (not yet activated) powers for a round.
 */
async function getQueuedPowers(roundId) {
  const [rows] = await pool.execute(
    `SELECT rp.*, p.name, p.cost, p.description
     FROM round_powers rp JOIN powers p ON rp.power_id = p.id
     WHERE rp.round_id = ? AND rp.queued = TRUE AND rp.activated = FALSE`,
    [roundId]
  );
  return rows;
}

/**
 * Auto-activate all queued powers for a round (called when guessing phase starts).
 * Points were already deducted during queuePower — no re-deduction here.
 */
async function applyQueuedPowers(io, roundId, roomCode) {
  const queuedPowers = await getQueuedPowers(roundId);
  if (!queuedPowers.length) return;

  // Need target_pct for cuartiles
  const [roundRows] = await pool.execute('SELECT * FROM rounds WHERE id=?', [roundId]);
  const round = roundRows[0];

  for (const rp of queuedPowers) {
    await pool.execute(
      'UPDATE round_powers SET activated=TRUE, queued=FALSE, activated_at=NOW() WHERE id=?',
      [rp.id]
    );

    if (rp.name === 'cuartiles') {
      const quartile = Math.min(Math.floor(parseFloat(round.target_pct) * 4), 3);
      const [activatorRows] = await pool.execute('SELECT socket_id FROM players WHERE id=?', [rp.player_id]);
      const activatorSocketId = activatorRows[0]?.socket_id;
      // Send quartile only to activator
      if (activatorSocketId) {
        io.to(activatorSocketId).emit('power_activated', {
          roundPowerId: rp.id, activatorId: rp.player_id,
          powerName: 'cuartiles',
          effect: { quartile, private: true },
        });
      }
      // Broadcast to everyone else (without quartile)
      io.in(roomCode).except(activatorSocketId ? [activatorSocketId] : []).emit('power_activated', {
        roundPowerId: rp.id, activatorId: rp.player_id,
        powerName: 'cuartiles',
        effect: { private: true },
      });
      continue;
    }

    if (rp.name === 'escudo') {
      // Silent — only notify the activator
      const [activatorRows] = await pool.execute('SELECT socket_id FROM players WHERE id=?', [rp.player_id]);
      if (activatorRows[0]?.socket_id) {
        io.to(activatorRows[0].socket_id).emit('power_activated', {
          roundPowerId: rp.id, activatorId: rp.player_id,
          powerName: 'escudo', effect: {},
        });
      }
      continue;
    }

    let broadcastEffect = {};

    if (rp.name === 'bloqueo') {
      broadcastEffect = { targetId: rp.target_player };
      const [targetRows] = await pool.execute('SELECT socket_id FROM players WHERE id=?', [rp.target_player]);
      if (targetRows[0]?.socket_id) {
        io.to(targetRows[0].socket_id).emit('bloqueo_applied', { roundId, blockedPlayerId: rp.target_player });
      }
    }

    if (rp.name === 'veneno' || rp.name === 'switch') {
      broadcastEffect = { targetId: rp.target_player };
    }

    io.to(roomCode).emit('power_activated', {
      roundPowerId: rp.id,
      activatorId: rp.player_id,
      powerName: rp.name,
      effect: broadcastEffect,
    });
  }

  // Emit updated scores once (points already deducted during queueing)
  const { getPlayersForGame } = require('./playerService');
  const players = await getPlayersForGame(round.game_id);
  io.to(roomCode).emit('scores_updated', { players });
}

/**
 * Activate a power immediately (guessing phase only).
 * Returns the effect payload to broadcast.
 * Deducts cost from player.score.
 */
async function activatePower(roundPowerId, playerId, targetPlayerId = null, isFree = false) {
  const [rows] = await pool.execute(
    `SELECT rp.*, p.name, p.cost, p.description
     FROM round_powers rp JOIN powers p ON rp.power_id = p.id
     WHERE rp.id = ? AND rp.player_id = ?`,
    [roundPowerId, playerId]
  );

  if (!rows.length) throw new Error('Power not found');
  const rp = rows[0];
  if (rp.activated) throw new Error('Power already used');

  // Anti-stacking: only one activation per power type per round
  await checkPowerTypeConflict(rp.round_id, rp.power_id);

  // Deduct cost only if not already purchased and not free
  if (!isFree && !rp.purchased) {
    const [playerRows] = await pool.execute('SELECT score FROM players WHERE id=?', [playerId]);
    if (!playerRows.length) throw new Error('Player not found');
    if (playerRows[0].score < rp.cost) throw new Error('INSUFFICIENT_POINTS');
    await pool.execute('UPDATE players SET score = score - ? WHERE id=?', [rp.cost, playerId]);
  }

  // Mark activated (clear queued flag in case it was queued somehow)
  await pool.execute(
    'UPDATE round_powers SET activated=TRUE, queued=FALSE, target_player=?, activated_at=NOW() WHERE id=?',
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

module.exports = { offerPowers, purchasePower, queuePower, getQueuedPowers, applyQueuedPowers, activatePower, getActivePowers };
