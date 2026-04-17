const router = require('express').Router();
const cache = require('../cache/redis');

const uuidv4 = () => require('crypto').randomUUID();

// POST /api/players/join — join or register in a game
router.post('/join', async (req, res) => {
  const { game_id, display_name, photo_path } = req.body;
  if (!game_id || !display_name) return res.status(400).json({ error: 'game_id and display_name required' });

  try {
    const game = await cache.getGame(game_id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.status === 'finished') return res.status(400).json({ error: 'Game already finished' });

    const existingPlayers = await cache.getPlayers(game_id);
    const isHost = existingPlayers.length === 0;
    const turnOrder = existingPlayers.length;

    const player = {
      id: uuidv4(),
      game_id,
      display_name: display_name.trim().substring(0, 50),
      photo_path: photo_path || null,
      score: 0,
      team: null,
      is_host: isHost,
      is_spectator: false,
      socket_id: null,
      connected: false,
      turn_order: turnOrder,
    };

    await cache.setPlayer(game_id, player);
    res.json(player);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
