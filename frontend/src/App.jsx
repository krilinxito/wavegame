import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import Splash from './pages/Splash';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import AnimatedBackground from './components/shared/AnimatedBackground';
import socket from './socket';
import { useSocket } from './hooks/useSocket';
import useGameStore from './store/gameStore';
import { playMusic, stopMusic, playSfx } from './utils/sound';

export default function App() {
  const [page, setPage] = useState('splash'); // 'splash' | 'home' | 'lobby' | 'game'
  const [error, setError] = useState('');
  const { game, round, gameOver } = useGameStore();
  const prevRoundStatusRef = React.useRef(null);

  useSocket(); // mount all socket listeners

  // Navigate based on game status
  useEffect(() => {
    if (game?.status === 'playing' && page === 'lobby') setPage('game');
    if (game?.status === 'lobby'   && page === 'game')  setPage('lobby');
  }, [game?.status]);

  // Music per page and round phase
  useEffect(() => {
    if (page === 'splash') { stopMusic(); return; }
    if (page === 'home')  { playMusic('music_home'); return; }
    if (page === 'lobby') { playMusic('music_lobby'); return; }
    if (page === 'game') {
      if (gameOver)                        { playMusic('music_victory', { loop: false }); return; }
      if (!round)                          { stopMusic(); return; }
      if (round.status === 'clue_giving')                                          { playMusic('music_clue'); return; }
      if (round.status === 'guessing')                                              { playMusic('music_guess'); return; }
      stopMusic();
    }
  }, [page, round?.status, !!gameOver]);

  // sfx_clue when psychic submits (clue_giving → guessing)
  useEffect(() => {
    if (prevRoundStatusRef.current === 'clue_giving' && round?.status === 'guessing') {
      playSfx('sfx_clue');
    }
    prevRoundStatusRef.current = round?.status ?? null;
  }, [round?.status]);

  // Listen for socket errors to show toast
  useEffect(() => {
    const handler = (e) => {
      setError(e.detail.message);
      setTimeout(() => setError(''), 4000);
    };
    window.addEventListener('wave:error', handler);
    return () => window.removeEventListener('wave:error', handler);
  }, []);

  const handleJoin = (roomCode, gameId, displayName, photoPath) => {
    socket.connect();
    socket.emit('join_room', { roomCode, playerId: null, displayName, photoPath });
    socket.once('room_joined', () => setPage('lobby'));
    socket.once('error', ({ message }) => setError(message));
  };

  return (
    <>
      <AnimatedBackground />
      {/* Global error toast */}
      <AnimatePresence>
        {error && (
          <div style={{
            position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(239,68,68,0.9)', color: '#fff', borderRadius: 12,
            padding: '10px 20px', zIndex: 999, fontSize: 14, fontWeight: 700,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}>
            {error}
          </div>
        )}
      </AnimatePresence>

      {page === 'splash' && <Splash onPlay={() => setPage('home')} />}
      {page === 'home'  && <Home onJoin={handleJoin} />}
      {page === 'lobby' && <Lobby />}
      {page === 'game'  && <Game />}
    </>
  );
}
