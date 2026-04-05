const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// POST /api/games — create a new lobby
router.post('/', async (req, res) => {
  try {
    const id = uuidv4();
    let code;
    // ensure unique code
    let attempts = 0;
    while (attempts < 10) {
      code = generateRoomCode();
      const [rows] = await pool.execute('SELECT id FROM games WHERE room_code = ?', [code]);
      if (rows.length === 0) break;
      attempts++;
    }
    await pool.execute(
      'INSERT INTO games (id, room_code) VALUES (?, ?)',
      [id, code]
    );
    res.json({ id, room_code: code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// GET /api/games/:code — lookup game by room code
router.get('/:code', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM games WHERE room_code = ?',
      [req.params.code.toUpperCase()]
    );
    if (!rows.length) return res.status(404).json({ error: 'Game not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

module.exports = router;
