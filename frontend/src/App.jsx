import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import Splash from './pages/Splash';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import AnimatedBackground from './components/shared/AnimatedBackground';
import SettingsModal from './components/shared/SettingsModal';
import { SettingsProvider } from './context/SettingsContext';
import socket from './socket';
import { useSocket } from './hooks/useSocket';
import useGameStore from './store/gameStore';
import { playMusic, stopMusic, playSfx } from './utils/sound';
import { useLocalPlayer } from './hooks/useLocalPlayer';

export default function App() {
  return (
    <SettingsProvider>
      <AppInner />
    </SettingsProvider>
  );
}

function AppInner() {
  const [page, setPage] = useState('splash'); // 'splash' | 'home' | 'lobby' | 'game'
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const { game, round, gameOver } = useGameStore();
  const prevRoundStatusRef = React.useRef(null);
  const { savePlayer } = useLocalPlayer();

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
    if (page === 'lobby') { playMusic('music_lobby', { randomStart: true }); return; }
    if (page === 'game') {
      if (gameOver)                        { playMusic('music_victory', { loop: false }); return; }
      if (!round)                          { stopMusic(); return; }
      if (round.status === 'clue_giving')                                                                        { playMusic('music_clue', { randomStart: true }); return; }
      if (['guessing','revealing','scoring','revealed','done'].includes(round.status)) { playMusic('music_guess', { randomStart: true }); return; }
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

  // Handle kick
  useEffect(() => {
    const handler = () => {
      setPage('home');
      setError('Fuiste kickeado de la sala');
      setTimeout(() => setError(''), 4000);
    };
    window.addEventListener('wave:kicked', handler);
    return () => window.removeEventListener('wave:kicked', handler);
  }, []);

  const handleJoin = (roomCode, gameId, displayName, photoPath, savedPlayerId) => {
    socket.connect();
    socket.emit('join_room', { roomCode, playerId: savedPlayerId ?? null, displayName, photoPath });
    socket.once('room_joined', ({ myPlayer }) => {
      savePlayer(myPlayer.id, myPlayer.display_name, myPlayer.photo_path);
      setPage('lobby');
    });
    socket.once('error', ({ message }) => setError(message));
  };

  return (
    <>
      <AnimatedBackground />

      {/* Settings button — hidden on splash */}
      {page !== 'splash' && (
        <button
          onClick={() => setShowSettings(true)}
          style={{
            position: 'fixed', top: 14, right: 16, zIndex: 50,
            background: 'var(--c-surface)', border: '1px solid var(--c-border2)',
            borderRadius: 'var(--r-sm)', width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: 18,
          }}
        >
          ⚙
        </button>
      )}
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
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

      <div style={{ position: 'relative', zIndex: 1 }}>
        {page === 'splash' && <Splash onPlay={() => setPage('home')} />}
        {page === 'home'  && <Home onJoin={handleJoin} />}
        {page === 'lobby' && <Lobby />}
        {page === 'game'  && <Game />}
      </div>
    </>
  );
}
