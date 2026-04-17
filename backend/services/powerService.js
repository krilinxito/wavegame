const cache = require('../cache/redis');
const POWERS = require('../cache/powers');

const uuidv4 = () => require('crypto').randomUUID();

async function offerPowers(roundId, playerIds, mode, guaranteedIds = new Set()) {
  if (mode === 'teams') return {};

  const offers = {};

  for (const playerId of playerIds) {
    const isFree = guaranteedIds.has(playerId);
    if (!isFree && Math.random() < 0.25) {
      offers[playerId] = { roundPowerId: null, power: null, isFree: false };
      continue;
    }
    const power = POWERS[Math.floor(Math.random() * POWERS.length)];
    const rp = {
      id: uuidv4(),
      round_id: roundId,
      player_id: playerId,
      power_id: power.id,
      name: power.name,
      cost: power.cost,
      description: power.description,
      purchased: false,
      queued: false,
      activated: false,
      target_player: null,
      activated_at: null,
    };
    await cache.setRoundPower(roundId, rp);
    offers[playerId] = { roundPowerId: rp.id, power, isFree };
  }

  return offers;
}

async function checkPowerTypeConflict(roundId, powerName) {
  const all = await cache.getRoundPowers(roundId);
  const conflict = all.some(p => p.name === powerName && (p.activated || p.queued));
  if (conflict) throw new Error('POWER_TYPE_ALREADY_USED');
}

async function purchasePower(roundPowerId, gameId, playerId, isFree = false) {
  const rp = await cache.getRoundPowerById(roundPowerId);
  if (!rp) throw new Error('Power not found');
  if (rp.activated || rp.queued) throw new Error('Power already used');
  if (rp.purchased) throw new Error('Power already purchased');

  if (!isFree) {
    const player = await cache.getPlayer(gameId, playerId);
    if (!player) throw new Error('Player not found');
    if (player.score < rp.cost) throw new Error('INSUFFICIENT_POINTS');
    player.score -= rp.cost;
    await cache.setPlayer(gameId, player);
  }

  rp.purchased = true;
  await cache.setRoundPower(rp.round_id, rp);

  return { powerName: rp.name, cost: rp.cost };
}

async function queuePower(roundPowerId, gameId, playerId, targetPlayerId = null, isFree = false) {
  const rp = await cache.getRoundPowerById(roundPowerId);
  if (!rp) throw new Error('Power not found');
  if (rp.activated) throw new Error('Power already used');
  if (rp.queued) throw new Error('Power already queued');

  await checkPowerTypeConflict(rp.round_id, rp.name);

  if (!isFree && !rp.purchased) {
    const player = await cache.getPlayer(gameId, playerId);
    if (!player) throw new Error('Player not found');
    if (player.score < rp.cost) throw new Error('INSUFFICIENT_POINTS');
    player.score -= rp.cost;
    await cache.setPlayer(gameId, player);
  }

  rp.queued = true;
  rp.target_player = targetPlayerId;
  await cache.setRoundPower(rp.round_id, rp);

  return { powerName: rp.name, cost: rp.cost, targetPlayerId };
}

async function getQueuedPowers(roundId) {
  const all = await cache.getRoundPowers(roundId);
  return all.filter(p => p.queued && !p.activated);
}

async function applyQueuedPowers(io, roundId, roomCode) {
  const queuedPowers = await getQueuedPowers(roundId);
  if (!queuedPowers.length) return;

  const round = await cache.getRound(roundId);

  for (const rp of queuedPowers) {
    rp.activated = true;
    rp.queued = false;
    rp.activated_at = Date.now();
    await cache.setRoundPower(roundId, rp);

    if (rp.name === 'cuartiles') {
      const quartile = Math.min(Math.floor(parseFloat(round.target_pct) * 4), 3);
      const activator = await cache.getPlayer(round.game_id, rp.player_id);
      const activatorSocketId = activator?.socket_id;
      if (activatorSocketId) {
        io.to(activatorSocketId).emit('power_activated', {
          roundPowerId: rp.id, activatorId: rp.player_id,
          powerName: 'cuartiles', effect: { quartile, private: true },
        });
      }
      io.in(roomCode).except(activatorSocketId ? [activatorSocketId] : []).emit('power_activated', {
        roundPowerId: rp.id, activatorId: rp.player_id,
        powerName: 'cuartiles', effect: { private: true },
      });
      continue;
    }

    if (rp.name === 'escudo') {
      const activator = await cache.getPlayer(round.game_id, rp.player_id);
      if (activator?.socket_id) {
        io.to(activator.socket_id).emit('power_activated', {
          roundPowerId: rp.id, activatorId: rp.player_id,
          powerName: 'escudo', effect: {},
        });
      }
      continue;
    }

    let broadcastEffect = {};

    if (rp.name === 'bloqueo') {
      broadcastEffect = { targetId: rp.target_player };
      const target = await cache.getPlayer(round.game_id, rp.target_player);
      if (target?.socket_id) {
        io.to(target.socket_id).emit('bloqueo_applied', { roundId, blockedPlayerId: rp.target_player });
      }
    }

    if (rp.name === 'veneno' || rp.name === 'switch') {
      broadcastEffect = { targetId: rp.target_player };
    }

    io.to(roomCode).emit('power_activated', {
      roundPowerId: rp.id, activatorId: rp.player_id,
      powerName: rp.name, effect: broadcastEffect,
    });
  }

  const { getPlayersForGame } = require('./playerService');
  const players = await getPlayersForGame(round.game_id);
  io.to(roomCode).emit('scores_updated', { players });
}

async function activatePower(roundPowerId, gameId, playerId, targetPlayerId = null, isFree = false) {
  const rp = await cache.getRoundPowerById(roundPowerId);
  if (!rp) throw new Error('Power not found');
  if (rp.activated) throw new Error('Power already used');

  await checkPowerTypeConflict(rp.round_id, rp.name);

  if (!isFree && !rp.purchased) {
    const player = await cache.getPlayer(gameId, playerId);
    if (!player) throw new Error('Player not found');
    if (player.score < rp.cost) throw new Error('INSUFFICIENT_POINTS');
    player.score -= rp.cost;
    await cache.setPlayer(gameId, player);
  }

  rp.activated = true;
  rp.queued = false;
  rp.target_player = targetPlayerId;
  rp.activated_at = Date.now();
  await cache.setRoundPower(rp.round_id, rp);

  return { powerName: rp.name, cost: rp.cost, targetPlayerId };
}

async function getActivePowers(roundId) {
  const all = await cache.getRoundPowers(roundId);
  return all
    .filter(p => p.activated)
    .map(p => ({ activatorId: p.player_id, targetId: p.target_player, powerName: p.name }));
}

module.exports = { offerPowers, purchasePower, queuePower, getQueuedPowers, applyQueuedPowers, activatePower, getActivePowers };
