import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import PlayerAvatar from '../shared/PlayerAvatar';
import socket from '../../socket';
import useGameStore from '../../store/gameStore';

const POWER_ICONS = {
  cuartiles: '🔭',
  veneno:    '☠️',
  escudo:    '🛡️',
  bloqueo:   '🚫',
  switch:    '🔄',
};

const POWER_COLORS = {
  cuartiles: '#7c3aed',
  veneno:    '#ef4444',
  escudo:    '#3b82f6',
  bloqueo:   '#f97316',
  switch:    '#14b8a6',
};

export default function PowerCard() {
  const { myPower, players, myPlayer, round, game } = useGameStore();
  const [open, setOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [used, setUsed] = useState(false);

  // Reset used state when a new power is offered (new round)
  useEffect(() => { setUsed(false); setSelectedTarget(null); }, [myPower?.roundPowerId]);

  if (game?.mode === 'teams') return null;
  if (round?.status !== 'guessing' && round?.status !== 'clue_giving') return null;

  // Mala suerte placeholder — solo visible cuando ya es la fase de adivinación
  if (!myPower || myPower.power === null) {
    if (round?.status !== 'guessing') return null;
    return (
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 50, background: 'var(--c-surface)', border: '1px solid var(--c-border2)', borderRadius: 16, padding: '10px 16px', fontSize: 13, color: 'var(--c-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>🎲</span> Mala suerte, sin poder esta ronda
      </div>
    );
  }

  if (used) return null;

  const { roundPowerId, power, isFree } = myPower;
  const needsTarget = ['veneno', 'bloqueo', 'switch'].includes(power.name);
  const color = POWER_COLORS[power.name] || '#7c3aed';
  const icon = POWER_ICONS[power.name] || '✨';

  const eligibleTargets = players.filter(p =>
    p.id !== myPlayer?.id &&
    p.id !== round?.psychic_id &&
    p.connected
  );

  const activate = () => {
    if (needsTarget && !selectedTarget) return;
    socket.emit('activate_power', {
      roundPowerId,
      targetPlayerId: selectedTarget || null,
      isFree: !!isFree,
    });
    setUsed(true);
    setOpen(false);
  };

  return (
    <>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{
          position: 'fixed', bottom: 24, right: 24,
          zIndex: 50,
        }}
      >
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setOpen(true)}
          style={{
            background: `linear-gradient(135deg, ${color}cc, ${color}88)`,
            border: `2px solid ${color}`,
            borderRadius: 16,
            padding: '12px 20px',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: `0 4px 24px ${color}44`,
            color: '#fff',
            fontFamily: 'Nunito, sans-serif',
          }}
        >
          <span style={{ fontSize: 28 }}>{icon}</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'Fredoka One', fontSize: 16 }}>{power.name}</span>
              {isFree && (
                <span style={{ background: '#fbbf24', color: '#000', fontSize: 10, fontWeight: 800, borderRadius: 6, padding: '1px 6px', letterSpacing: 0.5 }}>
                  🎯 GRATIS
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              {isFree ? '¡Bullseye! Sin costo · Toca para activar' : `Costo: ${power.cost} pts · Toca para activar`}
            </div>
          </div>
        </motion.button>
      </motion.div>

      <Modal open={open} onClose={() => setOpen(false)} title={`${icon} ${power.name}`}>
        <p style={{ color: 'var(--c-muted)', fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>
          {power.description}
        </p>
        <div style={{ background: isFree ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.05)', border: isFree ? '1px solid #fbbf2444' : 'none', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 14 }}>
          {isFree ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🎯</span>
              <span style={{ fontFamily: 'Fredoka One', color: '#fbbf24', fontSize: 16 }}>¡Poder gratis por bullseye!</span>
              <span style={{ color: 'var(--c-muted)', fontSize: 12, textDecoration: 'line-through' }}>{power.cost} pts</span>
            </span>
          ) : (
            <>
              <span style={{ color: 'var(--c-muted)' }}>Costo: </span>
              <span style={{ fontFamily: 'Fredoka One', color, fontSize: 18 }}>{power.cost} pts</span>
              {' · '}
              <span style={{ color: 'var(--c-muted)', fontSize: 12 }}>Se descuenta de tu puntaje actual</span>
            </>
          )}
        </div>

        {needsTarget && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--c-muted)', marginBottom: 10 }}>Elegí un jugador:</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {eligibleTargets.map(p => (
                <motion.button
                  key={p.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedTarget(p.id)}
                  style={{
                    background: selectedTarget === p.id ? color + '33' : 'rgba(255,255,255,0.05)',
                    border: `2px solid ${selectedTarget === p.id ? color : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 12, padding: '8px 14px',
                    cursor: 'pointer', color: 'var(--c-text)',
                    fontFamily: 'Nunito, sans-serif', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <PlayerAvatar player={p} size={28} />
                  {p.display_name}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            variant="primary"
            onClick={activate}
            disabled={needsTarget && !selectedTarget}
            style={{ background: `linear-gradient(135deg, ${color}, ${color}aa)` }}
          >
            Activar
          </Button>
        </div>
      </Modal>
    </>
  );
}
