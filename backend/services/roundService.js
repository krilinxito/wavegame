const cache = require('../cache/redis');

const uuidv4 = () => require('crypto').randomUUID();

async function createRound(gameId, psychicId, roundNumber, teamNum = null) {
  const round = {
    id: uuidv4(),
    game_id: gameId,
    round_number: roundNumber,
    psychic_id: psychicId,
    target_pct: parseFloat(Math.random().toFixed(4)),
    clue: null,
    status: 'clue_giving',
    team_num: teamNum ?? null,
    started_at: Date.now(),
    revealed_at: null,
  };
  await cache.setRound(round);
  return round;
}

async function getRoundsForRoundNumber(gameId, roundNumber) {
  const rounds = await cache.getRoundsForGame(gameId);
  return rounds.filter(r => r.round_number === roundNumber);
}

async function getRound(roundId) {
  return cache.getRound(roundId);
}

async function setClue(roundId, clue) {
  const round = await cache.getRound(roundId);
  if (!round || round.status !== 'clue_giving') return;
  round.clue = clue.trim().substring(0, 255);
  round.status = 'guessing';
  await cache.setRound(round);
}

async function getGuesses(roundId) {
  return cache.getGuesses(roundId);
}

async function submitGuess(roundId, playerId, guessPct, isFirst = false) {
  const guess = {
    id: uuidv4(),
    round_id: roundId,
    player_id: playerId,
    guess_pct: guessPct,
    is_first: isFirst,
    score_delta: null,
    submitted_at: Date.now(),
  };
  await cache.setGuess(roundId, guess);
  return guess.id;
}

async function saveScoreDeltas(roundId, scoreResults) {
  for (const r of scoreResults) {
    const guess = await cache.getGuess(roundId, r.playerId);
    if (guess) {
      guess.score_delta = r.delta;
      await cache.setGuess(roundId, guess);
    }
  }
}

async function markRevealed(roundId) {
  const round = await cache.getRound(roundId);
  if (!round) return;
  round.status = 'revealing';
  round.revealed_at = Date.now();
  await cache.setRound(round);
}

async function markDone(roundId) {
  const round = await cache.getRound(roundId);
  if (!round) return;
  round.status = 'done';
  await cache.setRound(round);
}

async function getUnusedCategory(gameId) {
  const categories = await cache.getCategories(gameId);
  const unused = categories.filter(c => !c.used);
  if (!unused.length) return null;
  return unused[Math.floor(Math.random() * unused.length)];
}

async function markCategoryUsed(gameId, categoryId) {
  const cat = await cache.getCategory(gameId, categoryId);
  if (!cat) return;
  cat.used = true;
  await cache.setCategory(gameId, cat);
}

module.exports = {
  createRound, getRound, getRoundsForRoundNumber, setClue, getGuesses, submitGuess,
  saveScoreDeltas, markRevealed, markDone, getUnusedCategory, markCategoryUsed,
};
