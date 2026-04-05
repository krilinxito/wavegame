const pool = require('../db');
const { getPlayersForGame, updatePlayerSocket } = require('../services/playerService');
const { getGame, getGameByCode, updateGameConfig, startGame, rotatePsychic } = require('../services/gameService');
const { createRound, getUnusedCategory, markCategoryUsed } = require('../services/roundService');
const { offerPowers } = require('../services/powerService');
const uuidv4 = () => require('crypto').randomUUID();

module.exports = function lobbyHandlers(io, socket) {

  socket.on('join_room', async ({ roomCode, playerId, displayName, photoPath }) => {
    try {
      const game = await getGameByCode(roomCode);
      if (!game) return socket.emit('error', { code: 'NOT_FOUND', message: 'Sala no encontrada' });
      if (game.status === 'finished') return socket.emit('error', { code: 'GAME_OVER', message: 'El juego ya terminó' });

      socket.join(roomCode);

      let player;
      if (playerId) {
        // Reconnecting
        const [rows] = await pool.execute('SELECT * FROM players WHERE id=? AND game_id=?', [playerId, game.id]);
        player = rows[0];
      }

      if (!player) {
        // New player
        const id = uuidv4();
        const [existing] = await pool.execute('SELECT COUNT(*) as cnt FROM players WHERE game_id=?', [game.id]);
        const isHost = existing[0].cnt === 0;
        const turnOrder = existing[0].cnt;
        await pool.execute(
          'INSERT INTO players (id, game_id, display_name, photo_path, is_host, turn_order) VALUES (?, ?, ?, ?, ?, ?)',
          [id, game.id, (displayName || 'Player').trim().substring(0, 50), photoPath || null, isHost, turnOrder]
        );
        const [newRows] = await pool.execute('SELECT * FROM players WHERE id=?', [id]);
        player = newRows[0];
      }

      await updatePlayerSocket(player.id, socket.id, true);
      // Attach metadata to socket for disconnect handling
      socket.data.playerId = player.id;
      socket.data.gameId = game.id;
      socket.data.roomCode = roomCode;

      const allPlayers = await getPlayersForGame(game.id);
      // In lobby, only show connected players; during game show everyone
      const players = game.status === 'lobby'
        ? allPlayers.filter(p => p.connected)
        : allPlayers;
      const [categories] = await pool.execute(
        'SELECT id, term, left_extreme, right_extreme, created_by FROM categories WHERE game_id=? ORDER BY created_at',
        [game.id]
      );

      socket.emit('room_joined', { game, players, myPlayer: player, categories });
      socket.to(roomCode).emit('player_joined', { player: { ...player, socket_id: undefined } });

    } catch (err) {
      console.error('join_room error:', err);
      socket.emit('error', { code: 'SERVER_ERROR', message: err.message });
    }
  });

  socket.on('update_player', async ({ playerId, displayName, photoPath }) => {
    try {
      const updates = [];
      const vals = [];
      if (displayName) { updates.push('display_name=?'); vals.push(displayName.trim().substring(0, 50)); }
      if (photoPath !== undefined) { updates.push('photo_path=?'); vals.push(photoPath); }
      if (!updates.length) return;

      vals.push(playerId);
      await pool.execute(`UPDATE players SET ${updates.join(',')} WHERE id=?`, vals);
      const [rows] = await pool.execute('SELECT * FROM players WHERE id=?', [playerId]);
      const player = rows[0];
      io.to(socket.data.roomCode).emit('player_updated', { player });
    } catch (err) {
      socket.emit('error', { code: 'UPDATE_ERROR', message: err.message });
    }
  });

  socket.on('host_update_config', async ({ gameId, mode, range_min, range_max, win_condition, win_value, guess_time }) => {
    try {
      const player = await getPlayerFromSocket(socket.data.playerId);
      if (!player?.is_host) return socket.emit('error', { code: 'NOT_HOST', message: 'Solo el host puede cambiar la config' });

      await updateGameConfig(gameId, { mode, range_min, range_max, win_condition, win_value, guess_time });
      const game = await getGame(gameId);
      io.to(socket.data.roomCode).emit('config_updated', { game });
    } catch (err) {
      socket.emit('error', { code: 'CONFIG_ERROR', message: err.message });
    }
  });

  socket.on('add_category', async ({ gameId, term, left_extreme, right_extreme, playerId }) => {
    try {
      const id = uuidv4();
      await pool.execute(
        'INSERT INTO categories (id, game_id, term, left_extreme, right_extreme, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [id, gameId, term.trim(), left_extreme.trim(), right_extreme.trim(), playerId]
      );
      // Send category to all in lobby
      const [rows] = await pool.execute('SELECT id, term, left_extreme, right_extreme, created_by FROM categories WHERE id=?', [id]);
      io.to(socket.data.roomCode).emit('category_added', { category: rows[0] });
    } catch (err) {
      socket.emit('error', { code: 'CATEGORY_ERROR', message: err.message });
    }
  });

  socket.on('remove_category', async ({ categoryId, playerId }) => {
    try {
      // Only the creator or host can remove
      const [rows] = await pool.execute('SELECT * FROM categories WHERE id=?', [categoryId]);
      if (!rows.length) return;
      const cat = rows[0];
      const [playerRows] = await pool.execute('SELECT * FROM players WHERE id=?', [playerId]);
      const player = playerRows[0];
      if (cat.created_by !== playerId && !player?.is_host) return;

      await pool.execute('DELETE FROM categories WHERE id=?', [categoryId]);
      io.to(socket.data.roomCode).emit('category_removed', { categoryId });
    } catch (err) {
      socket.emit('error', { code: 'CATEGORY_ERROR', message: err.message });
    }
  });

  socket.on('host_start_game', async ({ gameId, playerId }) => {
    try {
      const [playerRows] = await pool.execute('SELECT * FROM players WHERE id=?', [playerId]);
      const player = playerRows[0];
      if (!player?.is_host) return socket.emit('error', { code: 'NOT_HOST', message: 'Solo el host puede iniciar' });

      const game = await getGame(gameId);
      if (game.status !== 'lobby') return socket.emit('error', { code: 'ALREADY_STARTED', message: 'El juego ya inició' });

      const allPlayers = await getPlayersForGame(gameId);

      if (game.mode === 'teams') {
        // Auto-spectate players not in a complete pair (team with 2 members)
        const teamCounts = {};
        for (const p of allPlayers) {
          if (p.team) teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
        }
        const completePairs = Object.values(teamCounts).filter(c => c === 2).length;
        if (completePairs === 0)
          return socket.emit('error', { code: 'NOT_ENOUGH_PLAYERS', message: 'Necesitás al menos una pareja completa para el modo Teams' });

        // Spectate players in incomplete teams or with no team
        for (const p of allPlayers) {
          const inCompletePair = p.team && teamCounts[p.team] === 2;
          if (!inCompletePair && !p.is_spectator) {
            await pool.execute('UPDATE players SET is_spectator=TRUE, team=NULL WHERE id=?', [p.id]);
          }
        }
      } else {
        const activePlayers = allPlayers.filter(p => !p.is_spectator);
        if (activePlayers.length < 2)
          return socket.emit('error', { code: 'NOT_ENOUGH_PLAYERS', message: 'Necesitás al menos 2 jugadores para iniciar' });
      }

      await startGame(gameId);
      const updatedGame = await getGame(gameId);
      io.to(socket.data.roomCode).emit('game_started', { game: updatedGame });

      // Start first round automatically
      await startNextRound(io, socket.data.roomCode, gameId, updatedGame.mode);

    } catch (err) {
      console.error('host_start_game error:', err);
      socket.emit('error', { code: 'START_ERROR', message: err.message });
    }
  });

  socket.on('send_reaction', ({ emoji }) => {
    if (!socket.data.roomCode) return;
    const validEmojis = ['👏','🔥','😂','😮','💀','❤️','🎯','😎','🤣','😭','🥶','🤯','🫡','💯','🗿','🤡','👀','✨','🎉','💥','🍆','🫠','🥵','😈'];
    if (!validEmojis.includes(emoji)) return;
    io.to(socket.data.roomCode).emit('reaction_received', {
      emoji,
      playerId: socket.data.playerId,
    });
  });

  socket.on('return_to_lobby', async ({ gameId }) => {
    try {
      const [hostRows] = await pool.execute('SELECT id FROM players WHERE game_id=? AND is_host=TRUE', [gameId]);
      if (hostRows[0]?.id !== socket.data.playerId) return;

      await pool.execute("UPDATE games SET status='lobby', current_round=0, psychic_id=NULL WHERE id=?", [gameId]);
      await pool.execute('UPDATE players SET score=0 WHERE game_id=?', [gameId]);
      await pool.execute('UPDATE categories SET used=FALSE WHERE game_id=?', [gameId]);

      const game = await getGame(gameId);
      const players = await getPlayersForGame(game.id);
      const [categories] = await pool.execute(
        'SELECT id, term, left_extreme, right_extreme, created_by FROM categories WHERE game_id=? ORDER BY created_at',
        [gameId]
      );
      io.to(socket.data.roomCode).emit('game_reset', { game, players, categories });
    } catch (err) {
      socket.emit('error', { code: 'RESET_ERROR', message: err.message });
    }
  });

  socket.on('set_team', async ({ team }) => {
    try {
      const playerId = socket.data.playerId;
      if (team !== null && (typeof team !== 'number' || team < 1)) return;

      if (team !== null) {
        const [members] = await pool.execute(
          'SELECT COUNT(*) as cnt FROM players WHERE game_id=? AND team=? AND id!=?',
          [socket.data.gameId, team, playerId]
        );
        if (members[0].cnt >= 2)
          return socket.emit('error', { code: 'TEAM_FULL', message: 'Esa pareja ya está completa' });
      }

      await pool.execute('UPDATE players SET team=?, is_spectator=FALSE WHERE id=?', [team, playerId]);
      const [rows] = await pool.execute('SELECT * FROM players WHERE id=?', [playerId]);
      io.to(socket.data.roomCode).emit('player_updated', { player: rows[0] });
    } catch (err) {
      socket.emit('error', { code: 'TEAM_ERROR', message: err.message });
    }
  });

  socket.on('toggle_spectator', async () => {
    try {
      const playerId = socket.data.playerId;
      const [rows] = await pool.execute('SELECT is_spectator FROM players WHERE id=?', [playerId]);
      const newVal = rows[0]?.is_spectator ? 0 : 1;
      await pool.execute('UPDATE players SET is_spectator=?, team=NULL WHERE id=?', [newVal, playerId]);
      const [updated] = await pool.execute('SELECT * FROM players WHERE id=?', [playerId]);
      io.to(socket.data.roomCode).emit('player_updated', { player: updated[0] });
    } catch (err) {
      socket.emit('error', { code: 'SPECTATOR_ERROR', message: err.message });
    }
  });

  socket.on('next_round', async ({ gameId }) => {
    try {
      const game = await getGame(gameId);
      await startNextRound(io, socket.data.roomCode, gameId, game.mode);
    } catch (err) {
      socket.emit('error', { code: 'ROUND_ERROR', message: err.message });
    }
  });

  // Disconnect: mark player as disconnected
  socket.on('disconnect', async () => {
    if (socket.data.playerId) {
      try {
        await updatePlayerSocket(socket.data.playerId, null, false);
        if (socket.data.roomCode) {
          socket.to(socket.data.roomCode).emit('player_left', { playerId: socket.data.playerId });
        }
      } catch (err) {
        console.error('disconnect error:', err);
      }
    }
  });
};

async function getPlayerFromSocket(playerId) {
  if (!playerId) return null;
  const [rows] = await pool.execute('SELECT * FROM players WHERE id=?', [playerId]);
  return rows[0] || null;
}

async function startNextRound(io, roomCode, gameId, mode) {
  const psychic = await rotatePsychic(gameId);
  if (!psychic) return;

  const game = await getGame(gameId);
  const category = await getUnusedCategory(gameId);
  if (!category) {
    // End game: winner is the player with most points
    const allPlayers = await getPlayersForGame(gameId);
    const active = allPlayers.filter(p => !p.is_spectator);
    const sorted = [...active].sort((a, b) => b.score - a.score);
    const winner = sorted[0] || null;
    await pool.execute("UPDATE games SET status='finished' WHERE id=?", [gameId]);
    io.to(roomCode).emit('game_over', {
      winner,
      winnerTeam: null,
      teamScore: null,
      finalScores: sorted,
      reason: 'no_categories',
    });
    return;
  }

  await markCategoryUsed(category.id);
  const round = await createRound(gameId, psychic.id, game.current_round);

  const players = await getPlayersForGame(gameId);
  const nonPsychicIds = players.filter(p => p.id !== psychic.id && p.connected).map(p => p.id);
  const powerOffers = await offerPowers(round.id, nonPsychicIds, mode);

  // Broadcast round_started to all (without target)
  const roundPublic = { ...round, target_pct: undefined };
  io.to(roomCode).emit('round_started', {
    round: roundPublic,
    category: {
      id: category.id,
      term: category.term,
      left_extreme: category.left_extreme,
      right_extreme: category.right_extreme,
      created_by: category.created_by,
    },
    psychicName: psychic.display_name,
  });

  // Send target_pct only to psychic's socket
  const [psychicRows] = await pool.execute('SELECT socket_id FROM players WHERE id=?', [psychic.id]);
  if (psychicRows[0]?.socket_id) {
    io.to(psychicRows[0].socket_id).emit('psychic_target', { roundId: round.id, targetPct: parseFloat(round.target_pct) });
  }

  // Send power offers individually
  for (const [playerId, offer] of Object.entries(powerOffers)) {
    const [pRows] = await pool.execute('SELECT socket_id FROM players WHERE id=?', [playerId]);
    if (pRows[0]?.socket_id) {
      io.to(pRows[0].socket_id).emit('power_offered', { roundPowerId: offer.roundPowerId, power: offer.power });
    }
  }
}

module.exports.startNextRound = startNextRound;
