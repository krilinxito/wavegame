const cache = require('../cache/redis');
const { getRound, setClue, getGuesses, submitGuess, getUnusedCategory, markCategoryUsed } = require('../services/roundService');
const { getActivePowers, applyQueuedPowers } = require('../services/powerService');
const { getPlayersForGame } = require('../services/playerService');
const { getGame } = require('../services/gameService');
const { triggerReveal } = require('../services/revealService');

module.exports = function roundHandlers(io, socket) {

  socket.on('submit_clue', async ({ roundId, clue }) => {
    try {
      const round = await getRound(roundId);
      if (!round) return socket.emit('error', { code: 'NOT_FOUND', message: 'Ronda no encontrada' });
      if (round.psychic_id !== socket.data.playerId)
        return socket.emit('error', { code: 'NOT_YOUR_TURN', message: 'Solo el psychic puede dar la pista' });
      if (round.status !== 'clue_giving')
        return socket.emit('error', { code: 'WRONG_PHASE', message: 'Fase incorrecta' });
      if (!clue?.trim())
        return socket.emit('error', { code: 'INVALID_CLUE', message: 'La pista no puede estar vacía' });

      await setClue(roundId, clue);
      await applyQueuedPowers(io, roundId, socket.data.roomCode);
      io.to(socket.data.roomCode).emit('clue_submitted', { roundId, clue: clue.trim() });
    } catch (err) {
      socket.emit('error', { code: 'CLUE_ERROR', message: err.message });
    }
  });

  socket.on('submit_guess', async ({ roundId, guessPct }) => {
    try {
      const playerId = socket.data.playerId;
      const gameId = socket.data.gameId;
      const round = await getRound(roundId);
      if (!round) return socket.emit('error', { code: 'NOT_FOUND', message: 'Ronda no encontrada' });
      if (round.status !== 'guessing') return socket.emit('error', { code: 'WRONG_PHASE', message: 'No es la fase de adivinanza' });
      if (round.psychic_id === playerId) return socket.emit('error', { code: 'PSYCHIC_CANT_GUESS', message: 'El psychic no puede adivinar' });

      // Teams mode: only players on the same team can guess this round
      if (round.team_num) {
        const player = await cache.getPlayer(gameId, playerId);
        if (player?.team !== round.team_num)
          return socket.emit('error', { code: 'WRONG_TEAM', message: 'Esta ronda no es de tu equipo' });
      }

      const pct = parseFloat(guessPct);
      if (isNaN(pct) || pct < 0 || pct > 1) return socket.emit('error', { code: 'INVALID_GUESS', message: 'Posición inválida (0-1)' });

      // Check if player is bloqueo'd
      const roundPowers = await cache.getRoundPowers(roundId);
      const isBlocked = roundPowers.some(rp => rp.name === 'bloqueo' && rp.target_player === playerId && rp.activated);
      if (isBlocked) return socket.emit('error', { code: 'BLOCKED', message: 'Estás bloqueado esta ronda' });

      // Check duplicate
      const existingGuess = await cache.getGuess(roundId, playerId);
      if (existingGuess) return socket.emit('error', { code: 'ALREADY_GUESSED', message: 'Ya adivinaste' });

      const game = await getGame(round.game_id);
      const guesses = await getGuesses(roundId);

      if (game.mode === 'basta' && guesses.length > 0)
        return socket.emit('error', { code: 'BASTA_CALLED', message: 'Ya se dijo BASTA' });

      const isFirst = game.mode === 'basta' && guesses.length === 0;

      await submitGuess(roundId, playerId, pct, isFirst);

      const player = await cache.getPlayer(gameId, playerId);
      io.to(socket.data.roomCode).emit('guess_submitted', {
        roundId, playerId, isFirst,
        playerName: player?.display_name,
        photoPath: player?.photo_path,
        submittedAt: Date.now(),
      });
      socket.emit('guess_confirmed', { roundId, guessPct: pct, submittedAt: Date.now() });

      // Check if all eligible players guessed
      const allPlayers = await getPlayersForGame(round.game_id);
      const eligible = round.team_num
        ? allPlayers.filter(p => p.team === round.team_num && p.id !== round.psychic_id && p.connected && !p.is_spectator)
        : allPlayers.filter(p => p.id !== round.psychic_id && p.connected && !p.is_spectator);

      const updatedGuesses = await getGuesses(roundId);
      const guessedIds = new Set(updatedGuesses.map(g => g.player_id));
      const blockedIds = new Set(roundPowers.filter(rp => rp.name === 'bloqueo' && rp.activated).map(rp => rp.target_player));
      const effectiveEligible = eligible.filter(p => !blockedIds.has(p.id));

      const allIn = effectiveEligible.every(p => guessedIds.has(p.id));
      if (allIn) {
        io.to(socket.data.roomCode).emit('all_guesses_in', { roundId });
        setTimeout(() => triggerReveal(io, socket.data.roomCode, roundId), 1500);
      } else if (isFirst && game.mode === 'basta') {
        setTimeout(() => triggerReveal(io, socket.data.roomCode, roundId), 1500);
      }

    } catch (err) {
      console.error('submit_guess error:', err);
      socket.emit('error', { code: 'GUESS_ERROR', message: err.message });
    }
  });

  socket.on('vote_skip_category', async ({ roundId }) => {
    try {
      const playerId = socket.data.playerId;
      const gameId = socket.data.gameId;

      const round = await getRound(roundId);
      if (!round || round.status !== 'clue_giving') return;

      // Skip is disabled in teams mode
      if (round.team_num) return;

      const player = await cache.getPlayer(gameId, playerId);
      if (!player || player.is_spectator) return;

      // Psychic cannot vote to skip
      if (round.psychic_id === playerId) return;

      await cache.toggleSkipVote(roundId, playerId);
      const votes = await cache.getSkipVotes(roundId);

      const allPlayers = await cache.getPlayers(gameId);
      // Exclude psychic from eligible voters
      const eligible = allPlayers.filter(p => p.id !== round.psychic_id && !p.is_spectator && p.connected);

      // Only count votes from currently eligible players
      const eligibleIds = new Set(eligible.map(p => p.id));
      const validVotes = votes.filter(id => eligibleIds.has(id));

      io.to(socket.data.roomCode).emit('skip_vote_updated', {
        roundId,
        votes: validVotes,
        total: eligible.length,
      });

      if (validVotes.length >= Math.ceil(eligible.length / 2)) {
        await cache.clearSkipVotes(roundId);

        const newCategory = await getUnusedCategory(gameId);
        if (!newCategory) {
          io.to(socket.data.roomCode).emit('skip_vote_updated', { roundId, votes: [], total: eligible.length });
          return;
        }
        await markCategoryUsed(gameId, newCategory.id);

        io.to(socket.data.roomCode).emit('category_skipped', {
          roundId,
          newCategory: {
            id: newCategory.id,
            term: newCategory.term,
            left_extreme: newCategory.left_extreme,
            right_extreme: newCategory.right_extreme,
            created_by: newCategory.created_by,
          },
        });
      }
    } catch (err) {
      console.error('vote_skip_category error:', err);
    }
  });

  socket.on('request_reveal', async ({ roundId }) => {
    try {
      const round = await getRound(roundId);
      if (!round) return socket.emit('error', { code: 'NOT_FOUND', message: 'Ronda no encontrada' });
      if (round.status !== 'guessing') return socket.emit('error', { code: 'WRONG_PHASE', message: 'No es la fase de adivinanza' });

      const playerId = socket.data.playerId;
      const allPlayers = await cache.getPlayers(round.game_id);
      const isHost = allPlayers.some(p => p.id === playerId && p.is_host);
      if (!isHost) return socket.emit('error', { code: 'NOT_AUTHORIZED', message: 'Solo el host puede revelar' });

      await triggerReveal(io, socket.data.roomCode, roundId);
    } catch (err) {
      socket.emit('error', { code: 'REVEAL_ERROR', message: err.message });
    }
  });

  socket.on('clue_timer_expired', async ({ roundId }) => {
    try {
      const round = await getRound(roundId);
      if (!round || round.status !== 'clue_giving') return;
      if (round.psychic_id !== socket.data.playerId) return;
      await triggerReveal(io, socket.data.roomCode, roundId);
    } catch (err) {
      console.error('clue_timer_expired error:', err);
    }
  });
};
