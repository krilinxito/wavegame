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
  const { players } = useGameStore();
  const [floating, setFloating] = useState([]);
  const [open, setOpen] = useState(false);

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
      <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              style={{
                display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center',
                background: 'var(--c-surface)', border: '1px solid var(--c-border2)',
                borderRadius: 16, padding: '8px 12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                maxWidth: '88vw',
              }}
            >
              {EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => send(e)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, padding: '2px 4px', borderRadius: 8, transition: 'transform 0.1s' }}
                  onMouseDown={ev => ev.currentTarget.style.transform = 'scale(1.4)'}
                  onMouseUp={ev => ev.currentTarget.style.transform = 'scale(1)'}
                >
                  {e}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle button */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-border2)',
            borderRadius: 999, padding: '6px 14px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', gap: 6,
            color: 'var(--c-text)',
          }}
        >
          😄 <span style={{ fontSize: 11, color: 'var(--c-muted)' }}>{open ? '▼' : '▲'}</span>
        </button>
      </div>
    </>
  );
}
