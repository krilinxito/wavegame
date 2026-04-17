const cache = require('../cache/redis');
const { activatePower, queuePower, purchasePower } = require('../services/powerService');
const { getPlayersForGame } = require('../services/playerService');
const { getRound } = require('../services/roundService');

module.exports = function powerHandlers(io, socket) {

  socket.on('purchase_power', async ({ roundPowerId, isFree }) => {
    try {
      const playerId = socket.data.playerId;
      const gameId = socket.data.gameId;

      const rp = await cache.getRoundPowerById(roundPowerId);
      if (!rp) return;
      const round = await getRound(rp.round_id);

      if (round.status !== 'clue_giving' && round.status !== 'guessing')
        return socket.emit('error', { code: 'WRONG_PHASE', message: 'No podés comprar poderes en esta fase' });

      await purchasePower(roundPowerId, gameId, playerId, !!isFree);

      socket.emit('power_purchased', { roundPowerId });

      const players = await getPlayersForGame(round.game_id);
      io.to(socket.data.roomCode).emit('scores_updated', { players });

    } catch (err) {
      if (err.message === 'INSUFFICIENT_POINTS') {
        socket.emit('error', { code: 'INSUFFICIENT_POINTS', message: 'No tenés suficientes puntos' });
      } else {
        socket.emit('error', { code: 'POWER_ERROR', message: err.message });
      }
    }
  });

  socket.on('queue_power', async ({ roundPowerId, targetPlayerId, isFree }) => {
    try {
      const playerId = socket.data.playerId;
      const gameId = socket.data.gameId;

      const rp = await cache.getRoundPowerById(roundPowerId);
      if (!rp) return;
      const round = await getRound(rp.round_id);

      if (round.status !== 'clue_giving')
        return socket.emit('error', { code: 'WRONG_PHASE', message: 'Solo podés encolar poderes durante la pista' });

      const effect = await queuePower(roundPowerId, gameId, playerId, targetPlayerId || null, !!isFree);

      socket.emit('power_queued', { roundPowerId, powerName: effect.powerName });

      const players = await getPlayersForGame(round.game_id);
      io.to(socket.data.roomCode).emit('scores_updated', { players });

    } catch (err) {
      if (err.message === 'INSUFFICIENT_POINTS') {
        socket.emit('error', { code: 'INSUFFICIENT_POINTS', message: 'No tenés suficientes puntos para este poder' });
      } else if (err.message === 'POWER_TYPE_ALREADY_USED') {
        socket.emit('error', { code: 'POWER_TYPE_ALREADY_USED', message: 'Este tipo de poder ya fue usado esta ronda' });
      } else {
        socket.emit('error', { code: 'POWER_ERROR', message: err.message });
      }
    }
  });

  socket.on('activate_power', async ({ roundPowerId, targetPlayerId, isFree }) => {
    try {
      const playerId = socket.data.playerId;
      const gameId = socket.data.gameId;

      const rp = await cache.getRoundPowerById(roundPowerId);
      if (!rp) return;
      const round = await getRound(rp.round_id);

      if (round.status !== 'guessing')
        return socket.emit('error', { code: 'WRONG_PHASE', message: 'La activación inmediata es solo durante la adivinación. En la fase de pista usá "Preparar"' });

      const effect = await activatePower(roundPowerId, gameId, playerId, targetPlayerId || null, !!isFree);

      let broadcastEffect = {};

      if (effect.powerName === 'cuartiles') {
        const quartile = Math.min(Math.floor(parseFloat(round.target_pct) * 4), 3);
        socket.emit('power_activated', {
          roundPowerId, activatorId: playerId,
          powerName: 'cuartiles', effect: { quartile, private: true },
        });
        socket.to(socket.data.roomCode).emit('power_activated', {
          roundPowerId, activatorId: playerId,
          powerName: 'cuartiles', effect: { private: true },
        });
        return;
      }

      if (effect.powerName === 'bloqueo') {
        broadcastEffect = { targetId: targetPlayerId };
        const target = await cache.getPlayer(gameId, targetPlayerId);
        if (target?.socket_id) {
          io.to(target.socket_id).emit('bloqueo_applied', { roundId: rp.round_id, blockedPlayerId: targetPlayerId });
        }
      }

      if (effect.powerName === 'veneno') {
        broadcastEffect = { targetId: targetPlayerId };
        // Deduct -3 immediately from target
        const { updatePlayerScore } = require('../services/playerService');
        await updatePlayerScore(gameId, targetPlayerId, -3);
      }

      if (effect.powerName === 'switch') {
        broadcastEffect = { targetId: targetPlayerId };
      }

      if (effect.powerName === 'escudo') {
        socket.emit('power_activated', {
          roundPowerId, activatorId: playerId,
          powerName: 'escudo', effect: {},
        });
        return;
      }

      io.to(socket.data.roomCode).emit('power_activated', {
        roundPowerId, activatorId: playerId,
        powerName: effect.powerName, effect: broadcastEffect,
      });

      const players = await getPlayersForGame(round.game_id);
      io.to(socket.data.roomCode).emit('scores_updated', { players });

    } catch (err) {
      if (err.message === 'INSUFFICIENT_POINTS') {
        socket.emit('error', { code: 'INSUFFICIENT_POINTS', message: 'No tenés suficientes puntos para este poder' });
      } else if (err.message === 'POWER_TYPE_ALREADY_USED') {
        socket.emit('error', { code: 'POWER_TYPE_ALREADY_USED', message: 'Este tipo de poder ya fue usado esta ronda' });
      } else {
        socket.emit('error', { code: 'POWER_ERROR', message: err.message });
      }
    }
  });
};
