import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import socket from './socket';
import { useSocket } from './hooks/useSocket';
import useGameStore from './store/gameStore';

export default function App() {
  const [page, setPage] = useState('home'); // 'home' | 'lobby' | 'game'
  const [error, setError] = useState('');
  const { game } = useGameStore();

  useSocket(); // mount all socket listeners

  // Navigate to game when game starts
  useEffect(() => {
    if (game?.status === 'playing' && page === 'lobby') {
      setPage('game');
    }
  }, [game?.status]);

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

      {page === 'home'  && <Home onJoin={handleJoin} />}
      {page === 'lobby' && <Lobby />}
      {page === 'game'  && <Game />}
    </>
  );
}
