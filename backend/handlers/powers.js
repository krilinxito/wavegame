const pool = require('../db');
const { activatePower } = require('../services/powerService');
const { getPlayersForGame } = require('../services/playerService');
const { getRound } = require('../services/roundService');

module.exports = function powerHandlers(io, socket) {

  socket.on('activate_power', async ({ roundPowerId, targetPlayerId, isFree }) => {
    try {
      const playerId = socket.data.playerId;

      // Validate round is in guessing phase
      const [rpRows] = await pool.execute('SELECT round_id FROM round_powers WHERE id=?', [roundPowerId]);
      if (!rpRows.length) return;
      const roundId = rpRows[0].round_id;
      const round = await getRound(roundId);

      if (round.status !== 'guessing') {
        return socket.emit('error', { code: 'WRONG_PHASE', message: 'Solo podés usar poderes durante la fase de adivinación' });
      }

      const effect = await activatePower(roundPowerId, playerId, targetPlayerId || null, !!isFree);

      let broadcastEffect = {};

      if (effect.powerName === 'cuartiles') {
        // Reveal quartile ONLY to the activator
        const quartile = Math.min(Math.floor(parseFloat(round.target_pct) * 4), 3);
        socket.emit('power_activated', {
          roundPowerId, activatorId: playerId,
          powerName: 'cuartiles',
          effect: { quartile, private: true },
        });
        // Broadcast to room that someone used a power (without revealing what quartile)
        socket.to(socket.data.roomCode).emit('power_activated', {
          roundPowerId, activatorId: playerId,
          powerName: 'cuartiles',
          effect: { private: true },
        });
        return;
      }

      if (effect.powerName === 'bloqueo') {
        broadcastEffect = { targetId: targetPlayerId };
        // Notify the blocked player specifically
        const [targetSocket] = await pool.execute('SELECT socket_id FROM players WHERE id=?', [targetPlayerId]);
        if (targetSocket[0]?.socket_id) {
          io.to(targetSocket[0].socket_id).emit('bloqueo_applied', { roundId, blockedPlayerId: targetPlayerId });
        }
      }

      if (effect.powerName === 'veneno') {
        broadcastEffect = { targetId: targetPlayerId };
      }

      if (effect.powerName === 'switch') {
        broadcastEffect = { targetId: targetPlayerId };
      }

      // escudo is silent — just show to the activator
      if (effect.powerName === 'escudo') {
        socket.emit('power_activated', {
          roundPowerId, activatorId: playerId,
          powerName: 'escudo', effect: {},
        });
        return;
      }

      // Broadcast to room
      io.to(socket.data.roomCode).emit('power_activated', {
        roundPowerId,
        activatorId: playerId,
        powerName: effect.powerName,
        effect: broadcastEffect,
      });

      // Update scores to reflect cost deduction
      const players = await getPlayersForGame(round.game_id);
      io.to(socket.data.roomCode).emit('scores_updated', { players });

    } catch (err) {
      if (err.message === 'INSUFFICIENT_POINTS') {
        socket.emit('error', { code: 'INSUFFICIENT_POINTS', message: 'No tenés suficientes puntos para este poder' });
      } else {
        socket.emit('error', { code: 'POWER_ERROR', message: err.message });
      }
    }
  });
};
