import { useEffect } from 'react';
import socket from '../socket';
import useGameStore from '../store/gameStore';

export function useSocket() {
  const store = useGameStore();

  useEffect(() => {
    socket.on('room_joined', ({ game, players, myPlayer, categories }) => {
      store.setGame(game);
      store.setPlayers(players);
      store.setMyPlayer(myPlayer);
      store.setCategories(categories || []);
    });

    socket.on('player_joined', ({ player }) => store.addPlayer(player));
    socket.on('player_updated', ({ player }) => store.updatePlayer(player));
    socket.on('player_left', ({ playerId }) => store.removePlayer(playerId));

    socket.on('config_updated', ({ game }) => store.setGame(game));
    socket.on('game_started', ({ game }) => store.setGame(game));

    socket.on('category_added', ({ category }) => store.addCategory(category));
    socket.on('category_removed', ({ categoryId }) => store.removeCategory(categoryId));

    socket.on('round_started', ({ round, category, psychicName }) => {
      store.setRound({ ...round, psychicName });
      store.setCategory(category);
      store.setRevealData(null);
      store.setMyPower(null);
      store.setGameOver(null);
      useGameStore.setState({ activePowers: [], submittedGuesses: [] });
    });

    socket.on('psychic_target', ({ roundId, targetPct }) => {
      const cur = useGameStore.getState().round;
      if (cur) store.setRound({ ...cur, targetPct });
    });

    socket.on('clue_submitted', ({ clue }) => {
      const cur = useGameStore.getState().round;
      if (cur) store.setRound({ ...cur, clue, status: 'guessing' });
    });

    socket.on('guess_submitted', ({ playerId, playerName, photoPath }) => {
      // No guessPct — positions hidden until reveal
      store.addSubmittedGuess({ playerId, playerName, photoPath, guessPct: null });
    });

    socket.on('guess_confirmed', ({ guessPct }) => {
      const myPlayer = useGameStore.getState().myPlayer;
      if (!myPlayer) return;
      store.addSubmittedGuess({
        playerId: myPlayer.id,
        playerName: myPlayer.display_name,
        photoPath: myPlayer.photo_path,
        guessPct,
      });
    });

    socket.on('power_offered', ({ roundPowerId, power }) => {
      store.setMyPower({ roundPowerId, power });
    });

    socket.on('power_activated', (data) => {
      store.addActivePower(data);
    });

    socket.on('bloqueo_applied', ({ blockedPlayerId }) => {
      // Mark current player as blocked if it's them
      const myPlayer = useGameStore.getState().myPlayer;
      if (myPlayer?.id === blockedPlayerId) {
        store.setMyPlayer({ ...myPlayer, isBlocked: true });
      }
    });

    socket.on('round_revealed', ({ roundId, targetPct, guesses, activePowers }) => {
      store.setRound(r => r ? { ...r, status: 'revealed' } : r);
      store.setRevealData({ targetPct, guesses, activePowers });
    });

    socket.on('scores_updated', ({ players }) => {
      store.setPlayers(players);
      const myPlayer = useGameStore.getState().myPlayer;
      if (myPlayer) {
        const updated = players.find(p => p.id === myPlayer.id);
        if (updated) store.setMyPlayer(updated);
      }
    });

    socket.on('game_over', ({ winner, finalScores }) => {
      store.setGameOver({ winner, finalScores });
    });

    socket.on('no_categories', () => {
      useGameStore.setState({ noCategories: true });
    });

    socket.on('game_reset', ({ game, players, categories }) => {
      const myPlayer = useGameStore.getState().myPlayer;
      const updatedMe = players.find(p => p.id === myPlayer?.id) ?? myPlayer;
      useGameStore.setState({
        game, players, myPlayer: updatedMe,
        round: null, category: null, myPower: null,
        revealData: null, gameOver: null, noCategories: false,
        activePowers: [], submittedGuesses: [],
        categories: categories || [],
      });
    });

    socket.on('error', ({ code, message }) => {
      console.warn('[Socket Error]', code, message);
      // Toast notifications handled in components
      window.dispatchEvent(new CustomEvent('wave:error', { detail: { code, message } }));
    });

    return () => {
      socket.off('room_joined');
      socket.off('player_joined');
      socket.off('player_updated');
      socket.off('player_left');
      socket.off('config_updated');
      socket.off('game_started');
      socket.off('category_added');
      socket.off('category_removed');
      socket.off('round_started');
      socket.off('psychic_target');
      socket.off('clue_submitted');
      socket.off('power_offered');
      socket.off('power_activated');
      socket.off('bloqueo_applied');
      socket.off('guess_submitted');
      socket.off('guess_confirmed');
      socket.off('round_revealed');
      socket.off('scores_updated');
      socket.off('game_over');
      socket.off('no_categories');
      socket.off('game_reset');
      socket.off('error');
    };
  }, []);

  return socket;
}
