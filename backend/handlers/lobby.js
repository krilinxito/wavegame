const cache = require('../cache/redis');
const { getPlayersForGame } = require('../services/playerService');
const { getGame, getGameByCode, updateGameConfig, startGame } = require('../services/gameService');
const { startNextRound } = require('../services/roundStartService');
const { triggerReveal } = require('../services/revealService');

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
        player = await cache.getPlayer(game.id, playerId);
      }

      if (!player) {
        const existingPlayers = await cache.getPlayers(game.id);
        const isHost = existingPlayers.length === 0;
        const turnOrder = existingPlayers.length;
        player = {
          id: uuidv4(),
          game_id: game.id,
          display_name: (displayName || 'Player').trim().substring(0, 50),
          photo_path: photoPath || null,
          score: 0,
          team: null,
          is_host: isHost,
          is_spectator: false,
          socket_id: socket.id,
          connected: true,
          turn_order: turnOrder,
        };
        await cache.setPlayer(game.id, player);
      } else {
        player.socket_id = socket.id;
        player.connected = true;
        await cache.setPlayer(game.id, player);
      }

      socket.data.playerId = player.id;
      socket.data.gameId = game.id;
      socket.data.roomCode = roomCode;

      const allPlayers = await getPlayersForGame(game.id);
      const players = game.status === 'lobby'
        ? allPlayers.filter(p => p.connected)
        : allPlayers;

      const categories = await cache.getCategories(game.id);
      const challenges = await cache.getChallenges(game.id);

      let activeRound = null;
      let activeCategory = null;
      if (game.status === 'playing') {
        const allRounds = await cache.getRoundsForGame(game.id);
        const active = allRounds.filter(r => ['clue_giving', 'guessing'].includes(r.status));
        activeRound = player.team
          ? (active.find(r => r.team_num === player.team) ?? active[0] ?? null)
          : (active[0] ?? null);
        if (activeRound?.category_id) {
          activeCategory = categories.find(c => c.id === activeRound.category_id) ?? null;
        }
      }

      socket.emit('room_joined', { game, players, myPlayer: player, categories, challenges, activeRound, activeCategory });
      socket.to(roomCode).emit('player_joined', { player: { ...player, socket_id: undefined } });

    } catch (err) {
      console.error('join_room error:', err);
      socket.emit('error', { code: 'SERVER_ERROR', message: err.message });
    }
  });

  socket.on('update_player', async ({ playerId, displayName, photoPath }) => {
    try {
      const player = await cache.getPlayer(socket.data.gameId, playerId);
      if (!player) return;
      if (displayName) player.display_name = displayName.trim().substring(0, 50);
      if (photoPath !== undefined) player.photo_path = photoPath;
      await cache.setPlayer(socket.data.gameId, player);
      io.to(socket.data.roomCode).emit('player_updated', { player });
    } catch (err) {
      socket.emit('error', { code: 'UPDATE_ERROR', message: err.message });
    }
  });

  socket.on('host_update_config', async ({ gameId, mode, range_min, range_max, win_condition, win_value, guess_time, score_bullseye, score_close, score_near, min_score, auto_advance }) => {
    try {
      const player = await cache.getPlayer(gameId, socket.data.playerId);
      if (!player?.is_host) return socket.emit('error', { code: 'NOT_HOST', message: 'Solo el host puede cambiar la config' });

      await updateGameConfig(gameId, { mode, range_min, range_max, win_condition, win_value, guess_time, score_bullseye, score_close, score_near, min_score, auto_advance });
      const game = await getGame(gameId);
      io.to(socket.data.roomCode).emit('config_updated', { game });
    } catch (err) {
      socket.emit('error', { code: 'CONFIG_ERROR', message: err.message });
    }
  });

  socket.on('add_category', async ({ gameId, term, left_extreme, right_extreme, playerId }) => {
    try {
      const category = {
        id: uuidv4(),
        game_id: gameId,
        term: term.trim(),
        left_extreme: left_extreme.trim(),
        right_extreme: right_extreme.trim(),
        created_by: playerId,
        used: false,
        created_at: Date.now(),
      };
      await cache.setCategory(gameId, category);
      io.to(socket.data.roomCode).emit('category_added', { category });
    } catch (err) {
      socket.emit('error', { code: 'CATEGORY_ERROR', message: err.message });
    }
  });

  socket.on('add_challenge', async ({ id, name, nameEn, description, descriptionEn }) => {
    try {
      const gameId = socket.data.gameId;
      const player = await cache.getPlayer(gameId, socket.data.playerId);
      if (!player?.is_host) return socket.emit('error', { code: 'NOT_HOST', message: 'Solo el host puede agregar retos' });
      const challenge = { id: id || uuidv4(), game_id: gameId, name, nameEn, description, descriptionEn, created_at: Date.now() };
      await cache.setChallenge(gameId, challenge);
      io.to(socket.data.roomCode).emit('challenge_added', { challenge });
    } catch (err) {
      socket.emit('error', { code: 'CHALLENGE_ERROR', message: err.message });
    }
  });

  socket.on('remove_challenge', async ({ challengeId }) => {
    try {
      const gameId = socket.data.gameId;
      const player = await cache.getPlayer(gameId, socket.data.playerId);
      if (!player?.is_host) return socket.emit('error', { code: 'NOT_HOST', message: 'Solo el host puede eliminar retos' });
      await cache.deleteChallenge(gameId, challengeId);
      io.to(socket.data.roomCode).emit('challenge_removed', { challengeId });
    } catch (err) {
      socket.emit('error', { code: 'CHALLENGE_ERROR', message: err.message });
    }
  });

  socket.on('remove_category', async ({ categoryId, playerId }) => {
    try {
      const gameId = socket.data.gameId;
      const cat = await cache.getCategory(gameId, categoryId);
      if (!cat) return;
      const player = await cache.getPlayer(gameId, playerId);
      if (cat.created_by !== playerId && !player?.is_host) return;

      await cache.deleteCategory(gameId, categoryId);
      io.to(socket.data.roomCode).emit('category_removed', { categoryId });
    } catch (err) {
      socket.emit('error', { code: 'CATEGORY_ERROR', message: err.message });
    }
  });

  socket.on('host_start_game', async ({ gameId, playerId }) => {
    try {
      const player = await cache.getPlayer(gameId, playerId);
      if (!player?.is_host) return socket.emit('error', { code: 'NOT_HOST', message: 'Solo el host puede iniciar' });

      const game = await getGame(gameId);
      if (game.status !== 'lobby') return socket.emit('error', { code: 'ALREADY_STARTED', message: 'El juego ya inició' });

      const allPlayers = await getPlayersForGame(gameId);

      if (game.mode === 'teams') {
        const teamCounts = {};
        for (const p of allPlayers) {
          if (p.team) teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
        }
        const completePairs = Object.values(teamCounts).filter(c => c === 2).length;
        if (completePairs === 0)
          return socket.emit('error', { code: 'NOT_ENOUGH_PLAYERS', message: 'Necesitás al menos una pareja completa para el modo Teams' });

        for (const p of allPlayers) {
          const inCompletePair = p.team && teamCounts[p.team] === 2;
          if (!inCompletePair && !p.is_spectator) {
            p.is_spectator = true;
            p.team = null;
            await cache.setPlayer(gameId, p);
          }
        }
      } else {
        const activePlayers = allPlayers.filter(p => !p.is_spectator);
        if (activePlayers.length < 2)
          return socket.emit('error', { code: 'NOT_ENOUGH_PLAYERS', message: 'Necesitás al menos 2 jugadores para iniciar' });
      }

      await startGame(gameId);
      const updatedGame = await getGame(gameId);

      try {
        await startNextRound(io, socket.data.roomCode, gameId, updatedGame.mode);
      } catch (roundErr) {
        updatedGame.status = 'lobby';
        await cache.setGame(updatedGame);
        throw roundErr;
      }

      io.to(socket.data.roomCode).emit('game_started', { game: updatedGame });

    } catch (err) {
      console.error('host_start_game error:', err);
      socket.emit('error', { code: 'START_ERROR', message: err.message });
    }
  });

  socket.on('send_reaction', ({ emoji }) => {
    if (!socket.data.roomCode) return;
    const validEmojis = ['👏','🔥','😂','😮','💀','❤️','🎯','😎','🤣','😭','🥶','🤯','🫡','💯','🗿','🤡','👀','✨','🎉','💥','🍆','🫠','🥵','😈'];
    if (!validEmojis.includes(emoji)) return;
    io.to(socket.data.roomCode).emit('reaction_received', { emoji, playerId: socket.data.playerId });
  });

  socket.on('return_to_lobby', async ({ gameId }) => {
    try {
      const hostPlayer = await cache.getPlayer(gameId, socket.data.playerId);
      if (!hostPlayer?.is_host) return;

      // Reset game state
      const game = await getGame(gameId);
      game.status = 'lobby';
      game.current_round = 0;
      game.psychic_id = null;
      await cache.setGame(game);

      // Reset player scores
      const allPlayers = await getPlayersForGame(gameId);
      for (const p of allPlayers) {
        p.score = 0;
        await cache.setPlayer(gameId, p);
      }

      // Reset categories
      const categories = await cache.getCategories(gameId);
      for (const cat of categories) {
        cat.used = false;
        await cache.setCategory(gameId, cat);
      }

      // Cleanup all round data
      await cache.cleanupRounds(gameId);

      const updatedPlayers = await getPlayersForGame(gameId);
      const updatedCategories = await cache.getCategories(gameId);
      io.to(socket.data.roomCode).emit('game_reset', { game, players: updatedPlayers, categories: updatedCategories });
    } catch (err) {
      socket.emit('error', { code: 'RESET_ERROR', message: err.message });
    }
  });

  socket.on('set_team', async ({ team }) => {
    try {
      const playerId = socket.data.playerId;
      const gameId = socket.data.gameId;
      if (team !== null && (typeof team !== 'number' || team < 1)) return;

      if (team !== null) {
        const players = await cache.getPlayers(gameId);
        const memberCount = players.filter(p => p.team === team && p.id !== playerId).length;
        if (memberCount >= 2)
          return socket.emit('error', { code: 'TEAM_FULL', message: 'Esa pareja ya está completa' });
      }

      const player = await cache.getPlayer(gameId, playerId);
      if (!player) return;
      player.team = team;
      player.is_spectator = false;
      await cache.setPlayer(gameId, player);
      io.to(socket.data.roomCode).emit('player_updated', { player });
    } catch (err) {
      socket.emit('error', { code: 'TEAM_ERROR', message: err.message });
    }
  });

  socket.on('toggle_spectator', async () => {
    try {
      const playerId = socket.data.playerId;
      const gameId = socket.data.gameId;
      const player = await cache.getPlayer(gameId, playerId);
      if (!player) return;
      player.is_spectator = !player.is_spectator;
      player.team = null;
      await cache.setPlayer(gameId, player);
      io.to(socket.data.roomCode).emit('player_updated', { player });
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

  socket.on('host_kick_player', async ({ targetPlayerId }) => {
    try {
      const player = await cache.getPlayer(socket.data.gameId, socket.data.playerId);
      if (!player?.is_host) return socket.emit('error', { code: 'NOT_HOST', message: 'Solo el host puede kickear' });
      if (targetPlayerId === socket.data.playerId) return;

      const target = await cache.getPlayer(socket.data.gameId, targetPlayerId);
      if (!target || target.is_host) return;

      const targetSocket = io.sockets.sockets.get(target.socket_id);
      if (targetSocket) {
        targetSocket.emit('you_were_kicked');
        targetSocket.disconnect(true);
      }
    } catch (err) {
      console.error('host_kick_player error:', err);
    }
  });

  socket.on('disconnect', async () => {
    if (!socket.data.playerId) return;
    try {
      const gameId = socket.data.gameId;
      const player = await cache.getPlayer(gameId, socket.data.playerId);
      if (!player) return;

      player.socket_id = null;
      player.connected = false;
      await cache.setPlayer(gameId, player);

      if (socket.data.roomCode) {
        socket.to(socket.data.roomCode).emit('player_left', { playerId: socket.data.playerId });

        // Si hay rondas en guessing, verificar si la desconexión completa el turno
        const game = await getGame(gameId);
        if (game?.status === 'playing') {
          const allRounds = await cache.getRoundsForGame(gameId);
          const guessingRounds = allRounds.filter(r => r.status === 'guessing');
          for (const round of guessingRounds) {
            const allPlayers = await getPlayersForGame(round.game_id);
            const eligible = round.team_num
              ? allPlayers.filter(p => p.team === round.team_num && p.id !== round.psychic_id && p.connected && !p.is_spectator)
              : allPlayers.filter(p => p.id !== round.psychic_id && p.connected && !p.is_spectator);
            if (eligible.length === 0) continue;
            const roundPowers = await cache.getRoundPowers(round.id);
            const guesses = await cache.getGuesses(round.id);
            const guessedIds = new Set(guesses.map(g => g.player_id));
            const blockedIds = new Set(roundPowers.filter(rp => rp.name === 'bloqueo' && rp.activated).map(rp => rp.target_player));
            const effectiveEligible = eligible.filter(p => !blockedIds.has(p.id));
            if (effectiveEligible.every(p => guessedIds.has(p.id))) {
              setTimeout(() => triggerReveal(io, socket.data.roomCode, round.id), 1500);
            }
          }
        }
      }

      if (player.is_host && gameId) {
        const allPlayers = await cache.getPlayers(gameId);
        const nextHost = allPlayers.find(p => p.id !== socket.data.playerId && p.connected);
        if (nextHost) {
          player.is_host = false;
          await cache.setPlayer(gameId, player);
          nextHost.is_host = true;
          await cache.setPlayer(gameId, nextHost);
          if (socket.data.roomCode) {
            io.to(socket.data.roomCode).emit('host_changed', { newHostId: nextHost.id });
          }
        }
      }
    } catch (err) {
      console.error('disconnect error:', err);
    }
  });
};
