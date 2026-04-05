const pool = require('../db');
const { getPlayersForGame } = require('./playerService');

async function getGame(gameId) {
  const [rows] = await pool.execute('SELECT * FROM games WHERE id = ?', [gameId]);
  return rows[0] || null;
}

async function getGameByCode(code) {
  const [rows] = await pool.execute('SELECT * FROM games WHERE room_code = ?', [code.toUpperCase()]);
  return rows[0] || null;
}

async function updateGameConfig(gameId, { mode, range_min, range_max, win_condition, win_value, guess_time, score_bullseye, score_close, score_near }) {
  await pool.execute(
    'UPDATE games SET mode=?, range_min=?, range_max=?, win_condition=?, win_value=?, guess_time=?, score_bullseye=?, score_close=?, score_near=? WHERE id=?',
    [mode, range_min, range_max, win_condition, win_value, guess_time ?? 120,
     score_bullseye ?? 4, score_close ?? 3, score_near ?? 2, gameId]
  );
}

async function startGame(gameId) {
  await pool.execute("UPDATE games SET status='playing' WHERE id=?", [gameId]);
}

async function rotatePsychic(gameId) {
  const game = await getGame(gameId);
  const players = await getPlayersForGame(gameId);
  const activePlayers = players.filter(p => p.connected && !p.is_spectator);
  if (!activePlayers.length) return null;

  let nextPsychic;
  if (!game.psychic_id) {
    nextPsychic = activePlayers[0];
  } else {
    const currentIdx = activePlayers.findIndex(p => p.id === game.psychic_id);
    nextPsychic = activePlayers[(currentIdx + 1) % activePlayers.length];
  }

  await pool.execute(
    'UPDATE games SET psychic_id=?, current_round=current_round+1 WHERE id=?',
    [nextPsychic.id, gameId]
  );

  return nextPsychic;
}

/**
 * Check if win condition is met.
 * Returns { won: true, winner: player|team } or { won: false }
 */
async function checkWinCondition(gameId) {
  const game = await getGame(gameId);
  const players = await getPlayersForGame(gameId);
  const active = players.filter(p => !p.is_spectator);

  if (game.mode === 'teams') {
    // Build team scores
    const teamScores = {};
    const teamPlayers = {};
    for (const p of active) {
      if (!p.team) continue;
      teamScores[p.team] = (teamScores[p.team] || 0) + p.score;
      teamPlayers[p.team] = [...(teamPlayers[p.team] || []), p];
    }

    const checkTeams = () => {
      const sorted = Object.entries(teamScores).sort(([,a],[,b]) => b - a);
      if (!sorted.length) return null;
      const [teamNum, score] = sorted[0];
      return { teamNum: parseInt(teamNum), score, members: teamPlayers[teamNum] || [] };
    };

    if (game.win_condition === 'points') {
      const best = checkTeams();
      if (best && best.score >= game.win_value) {
        await pool.execute("UPDATE games SET status='finished' WHERE id=?", [gameId]);
        return { won: true, winner: best.members[0], winnerTeam: best.teamNum, teamScore: best.score, type: 'team_points' };
      }
    } else if (game.win_condition === 'rounds') {
      if (game.current_round >= game.win_value) {
        const best = checkTeams();
        await pool.execute("UPDATE games SET status='finished' WHERE id=?", [gameId]);
        return { won: true, winner: best?.members[0], winnerTeam: best?.teamNum, teamScore: best?.score, type: 'team_rounds' };
      }
    }
    return { won: false };
  }

  if (game.win_condition === 'points') {
    const winner = active.find(p => p.score >= game.win_value);
    if (winner) {
      await pool.execute("UPDATE games SET status='finished' WHERE id=?", [gameId]);
      return { won: true, winner, type: 'points' };
    }
  } else if (game.win_condition === 'rounds') {
    if (game.current_round >= game.win_value) {
      const sorted = [...active].sort((a, b) => b.score - a.score);
      const winner = sorted[0];
      await pool.execute("UPDATE games SET status='finished' WHERE id=?", [gameId]);
      return { won: true, winner, type: 'rounds' };
    }
  }

  return { won: false };
}

module.exports = { getGame, getGameByCode, updateGameConfig, startGame, rotatePsychic, checkWinCondition };
