import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import socket from '../../socket';
import useGameStore from '../../store/gameStore';

const EMOJIS = [
  '👏','🔥','😂','😮','💀','❤️','🎯','😎',
  '🤣','😭','🥶','🤯','🫡','💯','🗿','🤡',
  '👀','✨','🎉','💥','🍆','🫠','🥵','😈',
];

export default function ReactionBar() {
  const { players, myPlayer } = useGameStore();
  const [floating, setFloating] = useState([]);

  const addFloating = useCallback(({ emoji, playerId }) => {
    const sender = players.find(p => p.id === playerId);
    const id = Math.random().toString(36).slice(2);
    const x = 10 + Math.random() * 80; // % from left
    setFloating(prev => [...prev, { id, emoji, name: sender?.display_name ?? '', x }]);
    setTimeout(() => setFloating(prev => prev.filter(r => r.id !== id)), 2500);
  }, [players]);

  useEffect(() => {
    socket.on('reaction_received', addFloating);
    return () => socket.off('reaction_received', addFloating);
  }, [addFloating]);

  const send = (emoji) => {
    socket.emit('send_reaction', { emoji });
  };

  return (
    <>
      {/* Floating reactions overlay */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 100 }}>
        <AnimatePresence>
          {floating.map(r => (
            <motion.div
              key={r.id}
              initial={{ opacity: 1, y: 0, scale: 0.5 }}
              animate={{ opacity: 0, y: -180, scale: 1.2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.2, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                bottom: 80,
                left: `${r.x}%`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}
            >
              <span style={{ fontSize: 32 }}>{r.emoji}</span>
              <span style={{ fontSize: 10, color: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '1px 5px', fontWeight: 700 }}>
                {r.name}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Emoji strip */}
      <div style={{
        position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 6, zIndex: 50,
        background: 'var(--c-surface)', border: '1px solid var(--c-border2)',
        borderRadius: 999, padding: '6px 12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        overflowX: 'auto', maxWidth: '90vw',
      }}>
        {EMOJIS.map(e => (
          <button
            key={e}
            onClick={() => send(e)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 22, padding: '2px 4px', borderRadius: 8,
              transition: 'transform 0.1s',
            }}
            onMouseDown={ev => ev.currentTarget.style.transform = 'scale(1.4)'}
            onMouseUp={ev => ev.currentTarget.style.transform = 'scale(1)'}
          >
            {e}
          </button>
        ))}
      </div>
    </>
  );
}
