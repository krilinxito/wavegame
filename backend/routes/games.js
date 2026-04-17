const router = require('express').Router();
const cache = require('../cache/redis');

const uuidv4 = () => require('crypto').randomUUID();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// POST /api/games — create a new lobby
router.post('/', async (req, res) => {
  try {
    const id = uuidv4();
    let code;
    let attempts = 0;
    while (attempts < 10) {
      code = generateRoomCode();
      const existing = await cache.getRoomGameId(code);
      if (!existing) break;
      attempts++;
    }

    const game = {
      id,
      room_code: code,
      mode: 'normal',
      status: 'lobby',
      current_round: 0,
      psychic_id: null,
      range_min: 0,
      range_max: 100,
      win_condition: 'points',
      win_value: 10,
      guess_time: 120,
      score_bullseye: 4,
      score_close: 3,
      score_near: 2,
      created_at: Date.now(),
    };

    await cache.setGame(game);
    await cache.setRoom(code, id);

    res.json({ id, room_code: code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// GET /api/games/:code — lookup game by room code
router.get('/:code', async (req, res) => {
  try {
    const gameId = await cache.getRoomGameId(req.params.code);
    if (!gameId) return res.status(404).json({ error: 'Game not found' });
    const game = await cache.getGame(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: 'Redis error' });
  }
});

module.exports = router;
