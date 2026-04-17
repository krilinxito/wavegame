const cache = require('../cache/redis');
const { getPlayersForGame } = require('../services/playerService');
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

      socket.emit('room_joined', { game, players, myPlayer: player, categories });
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

  socket.on('host_update_config', async ({ gameId, mode, range_min, range_max, win_condition, win_value, guess_time }) => {
    try {
      const player = await cache.getPlayer(gameId, socket.data.playerId);
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
      io.to(socket.data.roomCode).emit('game_started', { game: updatedGame });

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

async function startNextRound(io, roomCode, gameId, mode) {
  if (mode === 'teams') {
    return startTeamsRound(io, roomCode, gameId);
  }

  const psychic = await rotatePsychic(gameId);
  if (!psychic) return;

  const game = await getGame(gameId);
  const category = await getUnusedCategory(gameId);
  if (!category) {
    const players = await cache.getPlayers(gameId);
    const sorted = players.filter(p => !p.is_spectator).sort((a, b) => b.score - a.score);
    game.status = 'finished';
    await cache.setGame(game);
    io.to(roomCode).emit('game_over', {
      winner: sorted[0] || null, winnerTeam: null, teamScore: null,
      finalScores: sorted, reason: 'no_categories',
    });
    return;
  }

  await markCategoryUsed(gameId, category.id);
  const round = await createRound(gameId, psychic.id, game.current_round);

  const players = await cache.getPlayers(gameId);
  const nonPsychicIds = players.filter(p => p.id !== psychic.id && p.connected && !p.is_spectator).map(p => p.id);

  // Players who got bullseye last round get a guaranteed power
  const bullseyeIds = await cache.client.smembers(`bullseye_winners:${gameId}:${game.current_round - 1}`);
  const guaranteedIds = new Set(bullseyeIds);

  const powerOffers = await offerPowers(round.id, nonPsychicIds, mode, guaranteedIds);

  const roundPublic = { ...round, target_pct: undefined };
  io.to(roomCode).emit('round_started', {
    round: roundPublic,
    category: {
      id: category.id, term: category.term,
      left_extreme: category.left_extreme, right_extreme: category.right_extreme,
      created_by: category.created_by,
    },
    psychicName: psychic.display_name,
  });

  if (psychic.socket_id) {
    io.to(psychic.socket_id).emit('psychic_target', { roundId: round.id, targetPct: round.target_pct });
  }

  for (const [playerId, offer] of Object.entries(powerOffers)) {
    const p = players.find(pl => pl.id === playerId);
    if (p?.socket_id) {
      io.to(p.socket_id).emit('power_offered', { roundPowerId: offer.roundPowerId, power: offer.power, isFree: !!offer.isFree });
    }
  }
}

async function startTeamsRound(io, roomCode, gameId) {
  const game = await getGame(gameId);
  const allPlayers = await cache.getPlayers(gameId);

  const teamNums = [...new Set(
    allPlayers.filter(p => p.team && !p.is_spectator).map(p => p.team)
  )].sort((a, b) => a - b);

  if (!teamNums.length) return;

  const newRoundNumber = game.current_round + 1;
  game.current_round = newRoundNumber;
  await cache.setGame(game);

  const teamRoundsData = [];

  for (const teamNum of teamNums) {
    const category = await getUnusedCategory(gameId);
    if (!category) {
      const active = allPlayers.filter(p => !p.is_spectator);
      const sorted = [...active].sort((a, b) => b.score - a.score);
      game.status = 'finished';
      await cache.setGame(game);
      io.to(roomCode).emit('game_over', {
        winner: sorted[0] || null, winnerTeam: null, teamScore: null,
        finalScores: sorted, reason: 'no_categories',
      });
      return;
    }
    await markCategoryUsed(gameId, category.id);

    const allTeamPlayers = allPlayers.filter(p => p.team === teamNum && !p.is_spectator);
    const connectedTeamPlayers = allTeamPlayers.filter(p => p.connected);
    if (!allTeamPlayers.length) continue;

    // Rotate psychic within team
    const gameRounds = await cache.getRoundsForGame(gameId);
    const pastTeamRounds = gameRounds.filter(r => r.team_num === teamNum).sort((a, b) => b.round_number - a.round_number);
    const lastPsychicId = pastTeamRounds[0]?.psychic_id ?? null;

    let psychic;
    if (!lastPsychicId) {
      psychic = allTeamPlayers[0];
    } else {
      const idx = allTeamPlayers.findIndex(p => p.id === lastPsychicId);
      psychic = allTeamPlayers[(idx + 1) % allTeamPlayers.length];
    }

    const round = await createRound(gameId, psychic.id, newRoundNumber, teamNum);
    const nonPsychicIds = connectedTeamPlayers.filter(p => p.id !== psychic.id).map(p => p.id);
    const powerOffers = await offerPowers(round.id, nonPsychicIds, 'teams');

    teamRoundsData.push({ round, category, psychic, teamNum, powerOffers });
  }

  const roundsPublic = teamRoundsData.map(({ round, category, psychic, teamNum }) => ({
    teamNum,
    round: { ...round, target_pct: undefined },
    category: {
      id: category.id, term: category.term,
      left_extreme: category.left_extreme, right_extreme: category.right_extreme,
      created_by: category.created_by,
    },
    psychicName: psychic.display_name,
  }));
  io.to(roomCode).emit('team_rounds_started', { teamRounds: roundsPublic });

  for (const { round, psychic, powerOffers } of teamRoundsData) {
    if (psychic.socket_id) {
      io.to(psychic.socket_id).emit('psychic_target', { roundId: round.id, targetPct: round.target_pct });
    }
    for (const [playerId, offer] of Object.entries(powerOffers)) {
      const p = allPlayers.find(pl => pl.id === playerId);
      if (p?.socket_id) {
        io.to(p.socket_id).emit('power_offered', { roundPowerId: offer.roundPowerId, power: offer.power, isFree: !!offer.isFree });
      }
    }
  }
}

module.exports.startNextRound = startNextRound;
