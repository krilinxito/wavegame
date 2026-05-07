const cache = require('../cache/redis');
const { getPlayersForGame } = require('./playerService');
const { getGame, rotatePsychic } = require('./gameService');
const { createRound, getUnusedCategory, markCategoryUsed } = require('./roundService');
const { offerPowers, carryOverPowers } = require('./powerService');

async function buildGameStats(gameId) {
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

async function startNextRound(io, roomCode, gameId, mode) {
  if (mode === 'teams') {
    return startTeamsRound(io, roomCode, gameId);
  }

  const psychic = await rotatePsychic(gameId);
  if (!psychic) throw new Error('No hay jugadores activos para iniciar la ronda');

  const game = await getGame(gameId);
  const category = await getUnusedCategory(gameId);
  if (!category) {
    const players = await cache.getPlayers(gameId);
    const sorted = players.filter(p => !p.is_spectator).sort((a, b) => b.score - a.score);
    game.status = 'finished';
    await cache.setGame(game);
    const stats = await buildGameStats(gameId);
    io.to(roomCode).emit('game_over', {
      winner: sorted[0] || null, winnerTeam: null, teamScore: null,
      finalScores: sorted, reason: 'no_categories', stats,
    });
    return;
  }

  await markCategoryUsed(gameId, category.id);

  const challenges = await cache.getChallenges(gameId);
  const challenge = challenges.length ? challenges[Math.floor(Math.random() * challenges.length)] : null;

  const round = await createRound(gameId, psychic.id, game.current_round, null, challenge);

  const players = await cache.getPlayers(gameId);
  const nonPsychicIds = players.filter(p => p.id !== psychic.id && p.connected && !p.is_spectator).map(p => p.id);

  const bullseyeIds = await cache.client.smembers(`bullseye_winners:${gameId}:${game.current_round - 1}`);
  const guaranteedIds = new Set(bullseyeIds);

  const allRounds = await cache.getRoundsForGame(gameId);
  const prevRound = allRounds.find(r => r.round_number === game.current_round - 1);
  const carryOverOffers = prevRound ? await carryOverPowers(prevRound.id, round.id) : {};

  const carryOverCounts = {};
  for (const [playerId, offers] of Object.entries(carryOverOffers)) {
    carryOverCounts[playerId] = offers.length;
  }

  if (guaranteedIds.has(psychic.id)) {
    const deferKey = `bullseye_winners:${gameId}:${round.round_number}`;
    await cache.client.sadd(deferKey, psychic.id);
    await cache.client.expire(deferKey, 7200);
    guaranteedIds.delete(psychic.id);
  }
  const allOfferedIds = nonPsychicIds;

  const powerOffers = await offerPowers(round.id, allOfferedIds, mode, guaranteedIds, carryOverCounts);

  const allOffers = { ...carryOverOffers };
  for (const [playerId, offers] of Object.entries(powerOffers)) {
    if (allOffers[playerId]) {
      allOffers[playerId] = [...allOffers[playerId], ...offers];
    } else {
      allOffers[playerId] = offers;
    }
  }

  const roundPublic = { ...round, target_pct: undefined };
  io.to(roomCode).emit('round_started', {
    round: roundPublic,
    category: {
      id: category.id, term: category.term,
      left_extreme: category.left_extreme, right_extreme: category.right_extreme,
      created_by: category.created_by,
    },
    psychicName: psychic.display_name,
    challenge: challenge ?? null,
  });

  if (psychic.socket_id) {
    io.to(psychic.socket_id).emit('psychic_target', { roundId: round.id, targetPct: round.target_pct });
  }

  for (const [playerId, offers] of Object.entries(allOffers)) {
    const p = players.find(pl => pl.id === playerId);
    if (p?.socket_id) {
      for (const offer of offers) {
        io.to(p.socket_id).emit('power_offered', {
          roundPowerId: offer.roundPowerId,
          power: offer.power,
          isFree: !!offer.isFree,
          purchased: !!offer.purchased,
        });
      }
    }
  }
}

async function startTeamsRound(io, roomCode, gameId) {
  const game = await getGame(gameId);
  const allPlayers = await cache.getPlayers(gameId);

  const teamNums = [...new Set(
    allPlayers.filter(p => p.team && !p.is_spectator).map(p => p.team)
  )].sort((a, b) => a - b);

  if (!teamNums.length) throw new Error('No hay equipos completos para iniciar la ronda');

  const newRoundNumber = game.current_round + 1;
  game.current_round = newRoundNumber;
  await cache.setGame(game);

  const teamRoundsData = [];

  for (const teamNum of teamNums) {
    const category = await getUnusedCategory(gameId);
    if (!category) {
      const active = allPlayers.filter(p => !p.is_spectator);
      const teamScores = {};
      for (const p of active) {
        if (!p.team) continue;
        teamScores[p.team] = (teamScores[p.team] || 0) + p.score;
      }
      const sortedTeams = Object.entries(teamScores).sort(([, a], [, b]) => b - a);
      const winnerTeamNum = sortedTeams.length ? parseInt(sortedTeams[0][0]) : null;
      const winnerTeamScore = sortedTeams.length ? sortedTeams[0][1] : null;
      game.status = 'finished';
      await cache.setGame(game);
      const stats = await buildGameStats(gameId);
      io.to(roomCode).emit('game_over', {
        winner: null,
        winnerTeam: winnerTeamNum,
        teamScore: winnerTeamScore,
        finalScores: [...active].sort((a, b) => b.score - a.score),
        reason: 'no_categories', stats,
      });
      return;
    }
    await markCategoryUsed(gameId, category.id);

    const allTeamPlayers = allPlayers.filter(p => p.team === teamNum && !p.is_spectator);
    const connectedTeamPlayers = allTeamPlayers.filter(p => p.connected);
    if (!allTeamPlayers.length) continue;

    const gameRounds = await cache.getRoundsForGame(gameId);
    const pastTeamRounds = gameRounds.filter(r => r.team_num === teamNum).sort((a, b) => b.round_number - a.round_number);
    const lastPsychicId = pastTeamRounds[0]?.psychic_id ?? null;

    let psychic;
    if (!lastPsychicId) {
      psychic = allTeamPlayers[0];
    } else {
      const idx = allTeamPlayers.findIndex(p => p.id === lastPsychicId);
      psychic = allTeamPlayers[(idx + 1) % allTeamPlayers.length];
    }

    const round = await createRound(gameId, psychic.id, newRoundNumber, teamNum);
    const nonPsychicIds = connectedTeamPlayers.filter(p => p.id !== psychic.id).map(p => p.id);
    const powerOffers = await offerPowers(round.id, nonPsychicIds, 'teams');

    teamRoundsData.push({ round, category, psychic, teamNum, powerOffers });
  }

  const roundsPublic = teamRoundsData.map(({ round, category, psychic, teamNum }) => ({
    teamNum,
    round: { ...round, target_pct: undefined },
    category: {
      id: category.id, term: category.term,
      left_extreme: category.left_extreme, right_extreme: category.right_extreme,
      created_by: category.created_by,
    },
    psychicName: psychic.display_name,
  }));
  io.to(roomCode).emit('team_rounds_started', { teamRounds: roundsPublic });

  for (const { round, psychic, powerOffers } of teamRoundsData) {
    if (psychic.socket_id) {
      io.to(psychic.socket_id).emit('psychic_target', { roundId: round.id, targetPct: round.target_pct });
    }
    for (const [playerId, offer] of Object.entries(powerOffers)) {
      const p = allPlayers.find(pl => pl.id === playerId);
      if (p?.socket_id) {
        io.to(p.socket_id).emit('power_offered', { roundPowerId: offer.roundPowerId, power: offer.power, isFree: !!offer.isFree });
      }
    }
  }
}

module.exports = { startNextRound, startTeamsRound };
