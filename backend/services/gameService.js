const cache = require('../cache/redis');

async function getGame(gameId) {
  return cache.getGame(gameId);
}

async function getGameByCode(code) {
  const gameId = await cache.getRoomGameId(code);
  if (!gameId) return null;
  return cache.getGame(gameId);
}

async function updateGameConfig(gameId, { mode, range_min, range_max, win_condition, win_value, guess_time, score_bullseye, score_close, score_near }) {
  const game = await cache.getGame(gameId);
  if (!game) return;
  Object.assign(game, {
    mode,
    range_min,
    range_max,
    win_condition,
    win_value,
    guess_time: guess_time ?? 120,
    score_bullseye: score_bullseye ?? 4,
    score_close: score_close ?? 3,
    score_near: score_near ?? 2,
  });
  await cache.setGame(game);
}

async function startGame(gameId) {
  const game = await cache.getGame(gameId);
  if (!game) return;
  game.status = 'playing';
  await cache.setGame(game);
}

async function rotatePsychic(gameId) {
  const game = await cache.getGame(gameId);
  const players = await cache.getPlayers(gameId);
  const activePlayers = players.filter(p => p.connected && !p.is_spectator);
  if (!activePlayers.length) return null;

  let nextPsychic;
  if (!game.psychic_id) {
    nextPsychic = activePlayers[0];
  } else {
    const currentIdx = activePlayers.findIndex(p => p.id === game.psychic_id);
    nextPsychic = activePlayers[(currentIdx + 1) % activePlayers.length];
  }

  game.psychic_id = nextPsychic.id;
  game.current_round = (game.current_round || 0) + 1;
  await cache.setGame(game);

  return nextPsychic;
}

async function checkWinCondition(gameId) {
  const game = await cache.getGame(gameId);
  const players = await cache.getPlayers(gameId);
  const active = players.filter(p => !p.is_spectator);

  if (game.mode === 'teams') {
    const teamScores = {};
    const teamPlayers = {};
    for (const p of active) {
      if (!p.team) continue;
      teamScores[p.team] = (teamScores[p.team] || 0) + p.score;
      teamPlayers[p.team] = [...(teamPlayers[p.team] || []), p];
    }

    const checkTeams = () => {
      const sorted = Object.entries(teamScores).sort(([, a], [, b]) => b - a);
      if (!sorted.length) return null;
      const [teamNum, score] = sorted[0];
      return { teamNum: parseInt(teamNum), score, members: teamPlayers[teamNum] || [] };
    };

    if (game.win_condition === 'points') {
      const best = checkTeams();
      if (best && best.score >= game.win_value) {
        game.status = 'finished';
        await cache.setGame(game);
        return { won: true, winner: best.members[0], winnerTeam: best.teamNum, teamScore: best.score, type: 'team_points' };
      }
    } else if (game.win_condition === 'rounds') {
      if (game.current_round >= game.win_value) {
        const best = checkTeams();
        game.status = 'finished';
        await cache.setGame(game);
        return { won: true, winner: best?.members[0], winnerTeam: best?.teamNum, teamScore: best?.score, type: 'team_rounds' };
      }
    }
    return { won: false };
  }

  if (game.win_condition === 'points') {
    const winner = active.find(p => p.score >= game.win_value);
    if (winner) {
      game.status = 'finished';
      await cache.setGame(game);
      return { won: true, winner, type: 'points' };
    }
  } else if (game.win_condition === 'rounds') {
    if (game.current_round >= game.win_value) {
      const sorted = [...active].sort((a, b) => b.score - a.score);
      game.status = 'finished';
      await cache.setGame(game);
      return { won: true, winner: sorted[0], type: 'rounds' };
    }
  }

  return { won: false };
}

module.exports = { getGame, getGameByCode, updateGameConfig, startGame, rotatePsychic, checkWinCondition };
