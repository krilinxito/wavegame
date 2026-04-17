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

    socket.on('host_changed', ({ newHostId }) => {
      // Update all players: clear old host flag, set new one
      useGameStore.setState(state => ({
        players: state.players.map(p => ({ ...p, is_host: p.id === newHostId })),
        myPlayer: state.myPlayer
          ? { ...state.myPlayer, is_host: state.myPlayer.id === newHostId }
          : state.myPlayer,
      }));
    });

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
      useGameStore.setState({ activePowers: [], submittedGuesses: [], teamRounds: {}, allTeamRoundsDone: false, myPowerQueued: false, myPowerPurchased: false });
    });

    socket.on('team_rounds_started', ({ teamRounds }) => {
      const myPlayer = useGameStore.getState().myPlayer;
      const myTeamNum = myPlayer?.team ?? null;

      const trMap = {};
      for (const tr of teamRounds) {
        trMap[tr.teamNum] = {
          round: { ...tr.round, psychicName: tr.psychicName },
          category: tr.category,
          revealData: null,
          submittedGuesses: [],
        };
      }

      const myTeamData = myTeamNum != null ? trMap[myTeamNum] : null;
      useGameStore.setState({
        teamRounds: trMap,
        round: myTeamData?.round ?? null,
        category: myTeamData?.category ?? null,
        revealData: null,
        myPower: null,
        gameOver: null,
        activePowers: [],
        submittedGuesses: [],
        allTeamRoundsDone: false,
        myPowerQueued: false,
        myPowerPurchased: false,
      });
    });

    socket.on('psychic_target', ({ roundId, targetPct }) => {
      const cur = useGameStore.getState().round;
      if (cur?.id === roundId) store.setRound({ ...cur, targetPct });
      // Also update teamRounds if present
      useGameStore.setState(state => {
        const entries = Object.entries(state.teamRounds);
        if (!entries.length) return {};
        const updated = {};
        for (const [tn, tr] of entries) {
          updated[tn] = tr.round?.id === roundId
            ? { ...tr, round: { ...tr.round, targetPct } }
            : tr;
        }
        return { teamRounds: updated };
      });
    });

    socket.on('clue_submitted', ({ roundId, clue }) => {
      const cur = useGameStore.getState().round;
      if (cur?.id === roundId) store.setRound({ ...cur, clue, status: 'guessing' });
      // Update other team's round if in teams mode
      useGameStore.setState(state => {
        const entries = Object.entries(state.teamRounds);
        if (!entries.length) return {};
        const updated = {};
        for (const [tn, tr] of entries) {
          updated[tn] = tr.round?.id === roundId
            ? { ...tr, round: { ...tr.round, clue, status: 'guessing' } }
            : tr;
        }
        return { teamRounds: updated };
      });
    });

    socket.on('guess_submitted', ({ roundId, playerId, playerName, photoPath, submittedAt }) => {
      // Only add to submittedGuesses if it's my team's active round
      const myRound = useGameStore.getState().round;
      if (!roundId || myRound?.id === roundId) {
        store.addSubmittedGuess({ playerId, playerName, photoPath, guessPct: null, submittedAt });
      }
      // Track in teamRounds for sidebar status
      useGameStore.setState(state => {
        const entries = Object.entries(state.teamRounds);
        if (!entries.length) return {};
        const updated = {};
        for (const [tn, tr] of entries) {
          if (tr.round?.id === roundId) {
            updated[tn] = {
              ...tr,
              submittedGuesses: [
                ...tr.submittedGuesses.filter(g => g.playerId !== playerId),
                { playerId, playerName, photoPath, guessPct: null },
              ],
            };
          } else {
            updated[tn] = tr;
          }
        }
        return { teamRounds: updated };
      });
    });

    socket.on('guess_confirmed', ({ guessPct, submittedAt }) => {
      const myPlayer = useGameStore.getState().myPlayer;
      if (!myPlayer) return;
      store.addSubmittedGuess({
        playerId: myPlayer.id,
        playerName: myPlayer.display_name,
        photoPath: myPlayer.photo_path,
        guessPct,
        submittedAt,
      });
    });

    socket.on('power_offered', ({ roundPowerId, power, isFree }) => {
      store.setMyPower({ roundPowerId, power, isFree: !!isFree });
    });

    socket.on('power_purchased', () => {
      store.setMyPowerPurchased(true);
    });

    socket.on('power_queued', () => {
      store.setMyPowerQueued(true);
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

    socket.on('round_revealed', ({ roundId, teamNum, targetPct, guesses, activePowers }) => {
      const revealPayload = { targetPct, guesses, activePowers };
      const myPlayer = useGameStore.getState().myPlayer;
      const isMyTeam = teamNum == null || myPlayer?.team === teamNum;

      if (isMyTeam) {
        useGameStore.setState(state => ({
          round: state.round ? { ...state.round, status: 'revealed' } : state.round,
          revealData: revealPayload,
        }));
      }

      // Update teamRounds map
      if (teamNum != null) {
        useGameStore.setState(state => ({
          teamRounds: {
            ...state.teamRounds,
            [teamNum]: state.teamRounds[teamNum]
              ? { ...state.teamRounds[teamNum], revealData: revealPayload, round: { ...state.teamRounds[teamNum].round, status: 'revealed' } }
              : state.teamRounds[teamNum],
          },
        }));
      }
    });

    socket.on('all_teams_round_done', () => {
      useGameStore.setState({ allTeamRoundsDone: true });
    });

    socket.on('scores_updated', ({ players }) => {
      store.setPlayers(players);
      const myPlayer = useGameStore.getState().myPlayer;
      if (myPlayer) {
        const updated = players.find(p => p.id === myPlayer.id);
        if (updated) store.setMyPlayer(updated);
      }
    });

    socket.on('game_over', ({ winner, winnerTeam, teamScore, finalScores }) => {
      store.setGameOver({ winner, winnerTeam: winnerTeam ?? null, teamScore: teamScore ?? null, finalScores });
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
        teamRounds: {}, allTeamRoundsDone: false,
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
      socket.off('host_changed');
      socket.off('config_updated');
      socket.off('game_started');
      socket.off('category_added');
      socket.off('category_removed');
      socket.off('round_started');
      socket.off('team_rounds_started');
      socket.off('psychic_target');
      socket.off('clue_submitted');
      socket.off('power_offered');
      socket.off('power_purchased');
      socket.off('power_queued');
      socket.off('power_activated');
      socket.off('bloqueo_applied');
      socket.off('guess_submitted');
      socket.off('guess_confirmed');
      socket.off('round_revealed');
      socket.off('all_teams_round_done');
      socket.off('scores_updated');
      socket.off('game_over');
      socket.off('no_categories');
      socket.off('game_reset');
      socket.off('error');
    };
  }, []);

  return socket;
}
