const uuidv4 = () => require('crypto').randomUUID();
const pool = require('../db');

async function createRound(gameId, psychicId, roundNumber, teamNum = null) {
  const id = uuidv4();
  const targetPct = Math.random().toFixed(4);
  await pool.execute(
    'INSERT INTO rounds (id, game_id, round_number, psychic_id, target_pct, team_num) VALUES (?, ?, ?, ?, ?, ?)',
    [id, gameId, roundNumber, psychicId, targetPct, teamNum]
  );
  const [rows] = await pool.execute('SELECT * FROM rounds WHERE id = ?', [id]);
  return rows[0];
}

async function getRoundsForRoundNumber(gameId, roundNumber) {
  const [rows] = await pool.execute(
    'SELECT * FROM rounds WHERE game_id=? AND round_number=?',
    [gameId, roundNumber]
  );
  return rows;
}

async function getRound(roundId) {
  const [rows] = await pool.execute('SELECT * FROM rounds WHERE id = ?', [roundId]);
  return rows[0] || null;
}

async function setClue(roundId, clue) {
  await pool.execute(
    "UPDATE rounds SET clue=?, status='guessing' WHERE id=? AND status='clue_giving'",
    [clue.trim().substring(0, 255), roundId]
  );
}

async function getGuesses(roundId) {
  const [rows] = await pool.execute(
    'SELECT * FROM guesses WHERE round_id = ? ORDER BY submitted_at ASC',
    [roundId]
  );
  return rows;
}

async function submitGuess(roundId, playerId, guessPct, isFirst = false) {
  const id = uuidv4();
  await pool.execute(
    'INSERT INTO guesses (id, round_id, player_id, guess_pct, is_first) VALUES (?, ?, ?, ?, ?)',
    [id, roundId, playerId, guessPct, isFirst]
  );
  return id;
}

async function saveScoreDeltas(roundId, scoreResults) {
  // scoreResults: [{ playerId, delta, reason }]
  for (const r of scoreResults) {
    await pool.execute(
      'UPDATE guesses SET score_delta=? WHERE round_id=? AND player_id=?',
      [r.delta, roundId, r.playerId]
    );
  }
}

async function markRevealed(roundId) {
  await pool.execute(
    "UPDATE rounds SET status='revealing', revealed_at=NOW() WHERE id=?",
    [roundId]
  );
}

async function markDone(roundId) {
  await pool.execute("UPDATE rounds SET status='done' WHERE id=?", [roundId]);
}

async function getUnusedCategory(gameId) {
  const [rows] = await pool.execute(
    'SELECT * FROM categories WHERE game_id=? AND used=FALSE ORDER BY RAND() LIMIT 1',
    [gameId]
  );
  return rows[0] || null;
}

async function markCategoryUsed(categoryId) {
  await pool.execute('UPDATE categories SET used=TRUE WHERE id=?', [categoryId]);
}

module.exports = {
  createRound, getRound, getRoundsForRoundNumber, setClue, getGuesses, submitGuess,
  saveScoreDeltas, markRevealed, markDone, getUnusedCategory, markCategoryUsed,
};
