import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import Splash from './pages/Splash';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import AnimatedBackground from './components/shared/AnimatedBackground';
import SettingsModal from './components/shared/SettingsModal';
import Modal from './components/shared/Modal';
import { SettingsProvider } from './context/SettingsContext';
import { useSettings } from './context/SettingsContext';
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
  const [page, setPage] = useState(() => {
    const code = window.location.pathname.slice(1).toUpperCase();
    return /^[A-Z0-9]{4,8}$/.test(code) ? 'home' : 'splash';
  }); // 'splash' | 'home' | 'lobby' | 'game'
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [dupTab, setDupTab] = useState(false);
  const { game, round, gameOver } = useGameStore();
  const prevRoundStatusRef = React.useRef(null);
  const { savePlayer } = useLocalPlayer();
  const { lang } = useSettings();

  const [tabId] = useState(() => {
    const stored = sessionStorage.getItem('wave_tab');
    if (stored) return stored;
    const id = Math.random().toString(36).slice(2);
    sessionStorage.setItem('wave_tab', id);
    return id;
  });

  useSocket(); // mount all socket listeners

  // Reset dupTab when returning to home
  useEffect(() => {
    if (page === 'home' || page === 'splash') setDupTab(false);
  }, [page]);

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

  // Detect same player connected in another tab
  useEffect(() => {
    if (page !== 'lobby' && page !== 'game') return;
    const roomCode = game?.room_code;
    if (!roomCode) return;

    const ch = new BroadcastChannel('wave_presence');
    const announce = () => ch.postMessage({ roomCode, tabId });
    announce();
    const timer = setInterval(announce, 5000);

    ch.onmessage = ({ data }) => {
      if (data.roomCode === roomCode && data.tabId !== tabId) setDupTab(true);
    };

    return () => { clearInterval(timer); ch.close(); };
  }, [page, game?.room_code]);

  const handleJoin = (roomCode, gameId, displayName, photoPath, savedPlayerId) => {
    socket.connect();
    socket.emit('join_room', { roomCode, playerId: savedPlayerId ?? null, displayName, photoPath });
    socket.once('room_joined', ({ myPlayer, game }) => {
      savePlayer(myPlayer.id, myPlayer.display_name);
      setPage(game?.status === 'playing' ? 'game' : 'lobby');
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
            maxWidth: '90vw', textAlign: 'center',
          }}>
            {error}
          </div>
        )}
      </AnimatePresence>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {page === 'splash' && <Splash onPlay={() => setPage('home')} />}
        {page === 'home'  && <Home onJoin={handleJoin} />}
        {page === 'lobby' && <Lobby onGoHome={() => { socket.disconnect(); useGameStore.getState().reset(); setPage('home'); }} />}
        {page === 'game'  && <Game onGoHome={() => { socket.disconnect(); useGameStore.getState().reset(); setPage('home'); }} />}
      </div>

      <Modal
        open={dupTab}
        onClose={() => setDupTab(false)}
        title={lang === 'en' ? '⚠ Already connected' : '⚠ Ya conectado'}
      >
        <p style={{ fontSize: 14, color: 'var(--c-muted)', marginBottom: 16 }}>
          {lang === 'en'
            ? 'You have this game open in another tab. Two connections may cause you to miss game events.'
            : 'Tenés esta partida abierta en otra pestaña. Dos conexiones pueden hacer que no recibas eventos del juego.'}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => window.close()}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 'var(--r-sm)',
              background: 'var(--c-accent)', color: '#fff', border: 'none',
              cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13,
            }}
          >
            {lang === 'en' ? 'Close this tab' : 'Cerrar esta pestaña'}
          </button>
          <button
            onClick={() => setDupTab(false)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 'var(--r-sm)',
              background: 'var(--c-surface2)', color: 'var(--c-text)',
              border: '1px solid var(--c-border2)',
              cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13,
            }}
          >
            {lang === 'en' ? 'Stay here' : 'Continuar igual'}
          </button>
        </div>
      </Modal>
    </>
  );
}
