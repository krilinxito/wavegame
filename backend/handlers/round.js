const pool = require('../db');
const { getRound, setClue, getGuesses, submitGuess, saveScoreDeltas, markRevealed, markDone } = require('../services/roundService');
const { computeScore, resolveBasta } = require('../services/scoringService');
const { getActivePowers } = require('../services/powerService');
const { updatePlayerScore, getPlayersForGame } = require('../services/playerService');
const { checkWinCondition, getGame } = require('../services/gameService');
const uuidv4 = () => require('crypto').randomUUID();

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
      io.to(socket.data.roomCode).emit('clue_submitted', { roundId, clue: clue.trim() });
    } catch (err) {
      socket.emit('error', { code: 'CLUE_ERROR', message: err.message });
    }
  });

  socket.on('submit_guess', async ({ roundId, guessPct }) => {
    try {
      const playerId = socket.data.playerId;
      const round = await getRound(roundId);
      if (!round) return socket.emit('error', { code: 'NOT_FOUND', message: 'Ronda no encontrada' });
      if (round.status !== 'guessing') return socket.emit('error', { code: 'WRONG_PHASE', message: 'No es la fase de adivinanza' });
      if (round.psychic_id === playerId) return socket.emit('error', { code: 'PSYCHIC_CANT_GUESS', message: 'El psychic no puede adivinar' });

      // Validate guess range
      const pct = parseFloat(guessPct);
      if (isNaN(pct) || pct < 0 || pct > 1) return socket.emit('error', { code: 'INVALID_GUESS', message: 'Posición inválida (0-1)' });

      // Check if player is bloqueo'd
      const [blockedRow] = await pool.execute(
        `SELECT rp.id FROM round_powers rp JOIN powers p ON rp.power_id=p.id
         WHERE rp.round_id=? AND p.name='bloqueo' AND rp.target_player=? AND rp.activated=TRUE`,
        [roundId, playerId]
      );
      if (blockedRow.length > 0) return socket.emit('error', { code: 'BLOCKED', message: 'Estás bloqueado esta ronda' });

      // Check duplicate
      const [existing] = await pool.execute('SELECT id FROM guesses WHERE round_id=? AND player_id=?', [roundId, playerId]);
      if (existing.length) return socket.emit('error', { code: 'ALREADY_GUESSED', message: 'Ya adivinaste' });

      const game = await getGame(round.game_id);
      const [guessCount] = await pool.execute('SELECT COUNT(*) as cnt FROM guesses WHERE round_id=?', [roundId]);

      // BASTA: only the first guess is allowed
      if (game.mode === 'basta' && guessCount[0].cnt > 0) {
        return socket.emit('error', { code: 'BASTA_CALLED', message: 'Ya se dijo BASTA' });
      }

      const isFirst = game.mode === 'basta' && guessCount[0].cnt === 0;

      await submitGuess(roundId, playerId, pct, isFirst);

      const [playerRows] = await pool.execute('SELECT display_name, photo_path FROM players WHERE id=?', [playerId]);
      // Broadcast to room WITHOUT position (so others can't see where you guessed)
      io.to(socket.data.roomCode).emit('guess_submitted', {
        roundId, playerId, isFirst,
        playerName: playerRows[0]?.display_name,
        photoPath: playerRows[0]?.photo_path,
      });
      // Send position only to the guesser as confirmation
      socket.emit('guess_confirmed', { roundId, guessPct: pct });

      // Check if all eligible players guessed
      const allPlayers = await getPlayersForGame(round.game_id);
      const eligible = allPlayers.filter(p => p.id !== round.psychic_id && p.connected && !p.is_spectator);
      const [guesses] = await pool.execute('SELECT player_id FROM guesses WHERE round_id=?', [roundId]);
      const guessedIds = new Set(guesses.map(g => g.player_id));

      // Remove bloqueo'd players from eligible
      const [blockedPlayers] = await pool.execute(
        `SELECT rp.target_player FROM round_powers rp JOIN powers p ON rp.power_id=p.id
         WHERE rp.round_id=? AND p.name='bloqueo' AND rp.activated=TRUE`, [roundId]
      );
      const blockedSet = new Set(blockedPlayers.map(b => b.target_player));
      const effectiveEligible = eligible.filter(p => !blockedSet.has(p.id));

      const allIn = effectiveEligible.every(p => guessedIds.has(p.id));
      if (allIn) {
        io.to(socket.data.roomCode).emit('all_guesses_in', { roundId });
        setTimeout(() => triggerReveal(io, socket, roundId), 1500);
      } else if (isFirst && game.mode === 'basta') {
        // BASTA: first guess triggers immediate reveal
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

      // Only host can manually trigger reveal
      const playerId = socket.data.playerId;
      const [hostRows] = await pool.execute('SELECT id FROM players WHERE game_id=? AND is_host=TRUE', [round.game_id]);
      const isHost = hostRows[0]?.id === playerId;
      if (!isHost) return socket.emit('error', { code: 'NOT_AUTHORIZED', message: 'Solo el host puede revelar' });

      await triggerReveal(io, socket, roundId);
    } catch (err) {
      socket.emit('error', { code: 'REVEAL_ERROR', message: err.message });
    }
  });
};

async function triggerReveal(io, socket, roundId) {
  const round = await getRound(roundId);
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
      // Update DB
      await pool.execute('UPDATE guesses SET guess_pct=? WHERE round_id=? AND player_id=?',
        [activatorGuess.guess_pct, roundId, activatorGuess.player_id]);
      await pool.execute('UPDATE guesses SET guess_pct=? WHERE round_id=? AND player_id=?',
        [targetGuess.guess_pct, roundId, targetGuess.player_id]);
    }
  }

  const targetPct = parseFloat(round.target_pct);
  const game = await getGame(round.game_id);

  let scoreResults;
  const scoring = { bullseye: game.score_bullseye ?? 4, close: game.score_close ?? 3, near: game.score_near ?? 2 };

  if (game.mode === 'basta') {
    scoreResults = resolveBasta(guesses, targetPct, activePowers, scoring);
  } else {
    scoreResults = guesses.map(g => {
      const { delta, reason } = computeScore(parseFloat(g.guess_pct), targetPct, g.player_id, activePowers, scoring);
      return { playerId: g.player_id, guessPct: parseFloat(g.guess_pct), delta, reason };
    });
  }

  // Apply veneno side-effects
  const venonoUsage = activePowers.find(p => p.powerName === 'veneno');
  if (venonoUsage?.targetId) {
    await updatePlayerScore(venonoUsage.targetId, -3);
    // Add to score_log
    await pool.execute(
      'INSERT INTO score_log (id, game_id, round_id, player_id, delta, reason) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), round.game_id, roundId, venonoUsage.targetId, -3, 'veneno_taken']
    );
  }

  // Apply score deltas
  await saveScoreDeltas(roundId, scoreResults);
  for (const r of scoreResults) {
    if (r.delta !== 0) {
      await updatePlayerScore(r.playerId, r.delta);
    }
    await pool.execute(
      'INSERT INTO score_log (id, game_id, round_id, player_id, delta, reason) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), round.game_id, roundId, r.playerId, r.delta, r.reason]
    );
  }

  // Psychic scoring: +1 per guesser that hit, -2 if nobody hit
  if (game.mode !== 'basta') {
    const hits = scoreResults.filter(r => r.delta > 0).length;
    const psychicDelta = hits > 0 ? hits : -2;
    const psychicReason = hits > 0 ? 'psychic_good_clue' : 'psychic_no_hits';
    await updatePlayerScore(round.psychic_id, psychicDelta);
    await pool.execute(
      'INSERT INTO score_log (id, game_id, round_id, player_id, delta, reason) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), round.game_id, roundId, round.psychic_id, psychicDelta, psychicReason]
    );
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
    targetPct,
    guesses: guessesForReveal,
    activePowers,
  });

  setTimeout(async () => {
    io.to(socket.data.roomCode).emit('scores_updated', { players });

    const winResult = await checkWinCondition(round.game_id);
    if (winResult.won) {
      io.to(socket.data.roomCode).emit('game_over', {
        winner: winResult.winner,
        winnerTeam: winResult.winnerTeam ?? null,
        teamScore: winResult.teamScore ?? null,
        finalScores: players.sort((a, b) => b.score - a.score),
      });
    }
  }, 500);
}

