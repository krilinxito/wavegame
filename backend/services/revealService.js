const cache = require('../cache/redis');
const { getRoundsForRoundNumber, markRevealed, markDone, getGuesses, saveScoreDeltas } = require('./roundService');
const { getActivePowers } = require('./powerService');
const { computeScore, resolveBasta } = require('./scoringService');
const { updatePlayerScore, getPlayersForGame } = require('./playerService');
const { checkWinCondition, getGame } = require('./gameService');
const { startNextRound } = require('./roundStartService');

async function computeGameStats(gameId) {
  const allRounds = await cache.getRoundsForGame(gameId);
  const stats = {};
  const ensure = (id) => { if (!stats[id]) stats[id] = { bullseyes: 0, bestDelta: 0, roundsAsPsychic: 0 }; };

  for (const r of allRounds) {
    if (r.psychic_id) { ensure(r.psychic_id); stats[r.psychic_id].roundsAsPsychic++; }
    const guesses = await cache.getGuesses(r.id);
    for (const g of guesses) {
      if (!g.player_id || g.score_delta == null) continue;
      ensure(g.player_id);
      if (g.score_delta >= 4) stats[g.player_id].bullseyes++;
      if (g.score_delta > stats[g.player_id].bestDelta) stats[g.player_id].bestDelta = g.score_delta;
    }
  }
  return stats;
}

async function triggerReveal(io, roomCode, roundId) {
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
    await cache.client.expire(key, 7200);
  }

  // Psychic scoring
  if (game.mode !== 'basta') {
    const hits = scoreResults.filter(r => r.delta > 0).length;
    const psychicDelta = hits > 0 ? hits : (game.mode === 'teams' ? -1 : -2);
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

  io.to(roomCode).emit('round_revealed', {
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
    io.to(roomCode).emit('all_teams_round_done', {});
    io.to(roomCode).emit('scores_updated', { players: updatedPlayers });

    const winResult = await checkWinCondition(round.game_id);
    if (winResult.won) {
      const stats = await computeGameStats(round.game_id);
      io.to(roomCode).emit('game_over', {
        winner: winResult.winner,
        winnerTeam: winResult.winnerTeam ?? null,
        teamScore: winResult.teamScore ?? null,
        finalScores: updatedPlayers.sort((a, b) => b.score - a.score),
        stats,
      });
    } else {
      const currentGame = await getGame(round.game_id);
      if (currentGame.auto_advance && currentGame.status === 'playing') {
        setTimeout(() => {
          startNextRound(io, roomCode, round.game_id, currentGame.mode)
            .catch(err => console.error('auto_advance error:', err));
        }, 5000);
      }
    }
  }, 500);
}

module.exports = { triggerReveal, computeGameStats };
