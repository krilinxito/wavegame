const cache = require('../cache/redis');
const { getRound, getRoundsForRoundNumber, setClue, getGuesses, submitGuess, saveScoreDeltas, markRevealed, markDone } = require('../services/roundService');
const { computeScore, resolveBasta } = require('../services/scoringService');
const { getActivePowers, applyQueuedPowers } = require('../services/powerService');
const { updatePlayerScore, getPlayersForGame } = require('../services/playerService');
const { checkWinCondition, getGame } = require('../services/gameService');

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
        setTimeout(() => triggerReveal(io, socket, roundId), 1500);
      } else if (isFirst && game.mode === 'basta') {
        setTimeout(() => triggerReveal(io, socket, roundId), 1500);
      }

    } catch (err) {
      console.error('submit_guess error:', err);
      socket.emit('error', { code: 'GUESS_ERROR', message: err.message });
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

      await triggerReveal(io, socket, roundId);
    } catch (err) {
      socket.emit('error', { code: 'REVEAL_ERROR', message: err.message });
    }
  });
};

async function triggerReveal(io, socket, roundId) {
  const round = await cache.getRound(roundId);
  if (!round || round.status === 'revealing' || round.status === 'done') return;

  await markRevealed(roundId);

  const activePowers = await getActivePowers(roundId);
  const guesses = await getGuesses(roundId);

  // Apply switch: swap guess positions between switch activator and target
  const switchPower = activePowers.find(p => p.powerName === 'switch');
  if (switchPower) {
    const activatorGuess = guesses.find(g => g.player_id === switchPower.activatorId);
    const targetGuess = guesses.find(g => g.player_id === switchPower.targetId);
    if (activatorGuess && targetGuess) {
      const temp = activatorGuess.guess_pct;
      activatorGuess.guess_pct = targetGuess.guess_pct;
      targetGuess.guess_pct = temp;
      await cache.setGuess(roundId, activatorGuess);
      await cache.setGuess(roundId, targetGuess);
    }
  }

  const targetPct = parseFloat(round.target_pct);
  const game = await getGame(round.game_id);
  const scoring = { bullseye: game.score_bullseye ?? 4, close: game.score_close ?? 3, near: game.score_near ?? 2 };

  let scoreResults;
  if (game.mode === 'basta') {
    scoreResults = resolveBasta(guesses, targetPct, activePowers, scoring);
    if (scoreResults.length > 0 && scoreResults[0].delta <= 0) {
      const allPlayers = await getPlayersForGame(round.game_id);
      const scoredIds = new Set(scoreResults.map(r => r.playerId));
      for (const p of allPlayers) {
        if (!scoredIds.has(p.id) && p.id !== round.psychic_id && !p.is_spectator) {
          scoreResults.push({ playerId: p.id, guessPct: null, delta: +1, reason: 'basta_others_win' });
        }
      }
    }
  } else {
    scoreResults = guesses.map(g => {
      const { delta, reason } = computeScore(parseFloat(g.guess_pct), targetPct, g.player_id, activePowers, scoring);
      return { playerId: g.player_id, guessPct: parseFloat(g.guess_pct), delta, reason };
    });
  }

  // Apply score deltas
  await saveScoreDeltas(roundId, scoreResults);
  for (const r of scoreResults) {
    if (r.delta !== 0) {
      await updatePlayerScore(round.game_id, r.playerId, r.delta);
    }
  }

  // Track bullseye winners for guaranteed power next round
  const bullseyeWinners = scoreResults.filter(r => r.reason === 'bullseye').map(r => r.playerId);
  if (bullseyeWinners.length) {
    const key = `bullseye_winners:${round.game_id}:${round.round_number}`;
    await cache.client.sadd(key, ...bullseyeWinners);
    await cache.client.expire(key, 7200); // auto-expire after 2h
  }

  // Psychic scoring
  if (game.mode !== 'basta') {
    const hits = scoreResults.filter(r => r.delta > 0).length;
    const psychicDelta = hits > 0 ? hits : -2;
    const psychicReason = hits > 0 ? 'psychic_good_clue' : 'psychic_no_hits';
    await updatePlayerScore(round.game_id, round.psychic_id, psychicDelta);
    scoreResults.push({ playerId: round.psychic_id, guessPct: null, delta: psychicDelta, reason: psychicReason });
  }

  await markDone(roundId);

  const players = await getPlayersForGame(round.game_id);
  const guessesForReveal = scoreResults.map(r => ({
    playerId: r.playerId,
    guessPct: r.guessPct,
    scoreDelta: r.delta,
    reason: r.reason,
    playerName: players.find(p => p.id === r.playerId)?.display_name,
  }));

  io.to(socket.data.roomCode).emit('round_revealed', {
    roundId,
    teamNum: round.team_num ?? null,
    targetPct,
    guesses: guessesForReveal,
    activePowers,
  });

  // In teams mode, wait for ALL team rounds to finish before scoring
  if (round.team_num) {
    const teamRounds = await getRoundsForRoundNumber(round.game_id, round.round_number);
    const allDone = teamRounds.every(r => r.status === 'done');
    if (!allDone) return;
  }

  setTimeout(async () => {
    const updatedPlayers = await getPlayersForGame(round.game_id);
    io.to(socket.data.roomCode).emit('all_teams_round_done', {});
    io.to(socket.data.roomCode).emit('scores_updated', { players: updatedPlayers });

    const winResult = await checkWinCondition(round.game_id);
    if (winResult.won) {
      // Cleanup game data after game over
      const gameData = await getGame(round.game_id);
      io.to(socket.data.roomCode).emit('game_over', {
        winner: winResult.winner,
        winnerTeam: winResult.winnerTeam ?? null,
        teamScore: winResult.teamScore ?? null,
        finalScores: updatedPlayers.sort((a, b) => b.score - a.score),
      });
      if (gameData) {
        await cache.cleanupGame(gameData.id, gameData.room_code);
      }
    }
  }, 500);
}
