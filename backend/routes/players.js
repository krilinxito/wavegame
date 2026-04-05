const router = require('express').Router();
const uuidv4 = () => require('crypto').randomUUID();
const pool = require('../db');

// POST /api/players/join — join or register in a game
router.post('/join', async (req, res) => {
  const { game_id, display_name, photo_path } = req.body;
  if (!game_id || !display_name) return res.status(400).json({ error: 'game_id and display_name required' });

  try {
    const [gameRows] = await pool.execute('SELECT id, status FROM games WHERE id = ?', [game_id]);
    if (!gameRows.length) return res.status(404).json({ error: 'Game not found' });
    if (gameRows[0].status === 'finished') return res.status(400).json({ error: 'Game already finished' });

    const [existingPlayers] = await pool.execute('SELECT COUNT(*) as cnt FROM players WHERE game_id = ?', [game_id]);
    const isHost = existingPlayers[0].cnt === 0;
    const turnOrder = existingPlayers[0].cnt;

    const id = uuidv4();
    await pool.execute(
      'INSERT INTO players (id, game_id, display_name, photo_path, is_host, turn_order) VALUES (?, ?, ?, ?, ?, ?)',
      [id, game_id, display_name.trim().substring(0, 50), photo_path || null, isHost, turnOrder]
    );

    const [player] = await pool.execute('SELECT * FROM players WHERE id = ?', [id]);
    res.json(player[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

module.exports = router;
