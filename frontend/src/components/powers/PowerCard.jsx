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

const SLOTS = 3;

function EmptySlot({ index }) {
  return (
    <div style={{
      width: 64, height: 72,
      border: '2px dashed rgba(255,255,255,0.1)',
      borderRadius: 14,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 4,
      opacity: 0.35,
    }}>
      <span style={{ fontSize: 20, filter: 'grayscale(1)', opacity: 0.4 }}>✦</span>
    </div>
  );
}

function PowerSlot({ power, isFree, queued, alreadyUsed, onClick }) {
  const color = POWER_COLORS[power.name] || '#7c3aed';
  const icon  = POWER_ICONS[power.name]  || '✨';

  return (
    <motion.button
      whileHover={alreadyUsed ? {} : { scale: 1.06 }}
      whileTap={alreadyUsed   ? {} : { scale: 0.94 }}
      onClick={alreadyUsed ? undefined : onClick}
      title={alreadyUsed ? 'Este poder ya fue usado esta ronda' : power.name}
      style={{
        width: 64, height: 72,
        background: alreadyUsed
          ? 'rgba(255,255,255,0.04)'
          : queued
            ? `${color}22`
            : `linear-gradient(145deg, ${color}33, ${color}18)`,
        border: `2px solid ${alreadyUsed ? 'rgba(255,255,255,0.1)' : queued ? `${color}66` : color}`,
        borderRadius: 14,
        cursor: alreadyUsed ? 'not-allowed' : 'pointer',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 4,
        padding: 0,
        position: 'relative',
        opacity: alreadyUsed ? 0.4 : 1,
        boxShadow: alreadyUsed || queued ? 'none' : `0 4px 16px ${color}33`,
      }}
    >
      <span style={{ fontSize: 26, lineHeight: 1 }}>{icon}</span>
      <span style={{
        fontFamily: 'Fredoka One', fontSize: 10,
        color: alreadyUsed ? 'var(--c-muted)' : queued ? `${color}cc` : '#fff',
        textAlign: 'center', lineHeight: 1.1,
        maxWidth: 56, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        padding: '0 4px',
      }}>
        {power.name}
      </span>

      {/* Badges */}
      {isFree && !alreadyUsed && !queued && (
        <span style={{
          position: 'absolute', top: -6, right: -6,
          background: '#fbbf24', color: '#000',
          fontSize: 8, fontWeight: 800,
          borderRadius: 6, padding: '1px 4px',
          letterSpacing: 0.3,
        }}>FREE</span>
      )}
      {queued && (
        <span style={{
          position: 'absolute', top: -6, right: -6,
          background: `${color}`, color: '#fff',
          fontSize: 9, fontWeight: 800,
          borderRadius: 6, padding: '1px 4px',
        }}>⏳</span>
      )}
      {alreadyUsed && (
        <span style={{
          position: 'absolute', top: -6, right: -6,
          background: 'rgba(255,255,255,0.15)', color: 'var(--c-muted)',
          fontSize: 8, fontWeight: 700,
          borderRadius: 6, padding: '1px 4px',
        }}>✓</span>
      )}
    </motion.button>
  );
}

export default function PowerCard() {
  const { myPower, myPowerQueued, activePowers, players, myPlayer, round, game } = useGameStore();
  const [open, setOpen]               = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [used, setUsed]               = useState(false);

  useEffect(() => {
    setUsed(false);
    setSelectedTarget(null);
  }, [myPower?.roundPowerId]);

  if (game?.mode === 'teams') return null;
  if (round?.status !== 'guessing' && round?.status !== 'clue_giving') return null;

  const isClueGiving   = round?.status === 'clue_giving';
  const hasPower       = myPower && myPower.power !== null;
  const { roundPowerId, power, isFree } = hasPower ? myPower : {};

  const alreadyUsedThisRound = hasPower && activePowers.some(p => p.powerName === power.name);
  const isQueued       = myPowerQueued && isClueGiving;
  const isDone         = (myPowerQueued && !isClueGiving) || used;

  const needsTarget    = hasPower && ['veneno', 'bloqueo', 'switch'].includes(power.name);
  const color          = hasPower ? (POWER_COLORS[power.name] || '#7c3aed') : '#7c3aed';

  const eligibleTargets = players.filter(p =>
    p.id !== myPlayer?.id &&
    p.id !== round?.psychic_id &&
    p.connected
  );

  const handleAction = () => {
    if (needsTarget && !selectedTarget) return;
    if (isClueGiving) {
      socket.emit('queue_power', {
        roundPowerId,
        targetPlayerId: selectedTarget || null,
        isFree: !!isFree,
      });
      setOpen(false);
    } else {
      socket.emit('activate_power', {
        roundPowerId,
        targetPlayerId: selectedTarget || null,
        isFree: !!isFree,
      });
      setUsed(true);
      setOpen(false);
    }
  };

  // Build the 3 slots
  const slots = Array.from({ length: SLOTS }, (_, i) => {
    if (i === 0 && hasPower && !isDone) {
      return {
        type: 'power',
        power, isFree, queued: isQueued,
        alreadyUsed: alreadyUsedThisRound,
      };
    }
    return { type: 'empty' };
  });

  const actionLabel = isClueGiving ? 'Reservar para guessing' : 'Activar';

  return (
    <>
      {/* Inventory panel */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          position: 'fixed', bottom: 24, right: 24,
          zIndex: 50,
          background: 'rgba(15,15,20,0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 18,
          padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}
      >
        <div style={{
          fontSize: 9, fontWeight: 700, color: 'var(--c-muted)',
          textTransform: 'uppercase', letterSpacing: 1.5,
          textAlign: 'center',
        }}>
          Poderes
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {slots.map((slot, i) =>
            slot.type === 'power' ? (
              <PowerSlot
                key={i}
                power={slot.power}
                isFree={slot.isFree}
                queued={slot.queued}
                alreadyUsed={slot.alreadyUsed}
                onClick={() => setOpen(true)}
              />
            ) : (
              <EmptySlot key={i} index={i} />
            )
          )}
        </div>

        {/* "Sin poder" hint solo en guessing */}
        {!hasPower && !isClueGiving && (
          <div style={{ fontSize: 10, color: 'var(--c-muted)', textAlign: 'center', marginTop: -2 }}>
            sin poder esta ronda
          </div>
        )}

        {/* Queued hint */}
        {isQueued && (
          <div style={{ fontSize: 10, color, textAlign: 'center', marginTop: -2 }}>
            ⏳ se activa al adivinar
          </div>
        )}
      </motion.div>

      {/* Modal */}
      {hasPower && !isDone && (
        <Modal open={open} onClose={() => setOpen(false)} title={`${POWER_ICONS[power.name] || '✨'} ${power.name}`}>
          <p style={{ color: 'var(--c-muted)', fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>
            {power.description}
          </p>

          {isClueGiving && (
            <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--c-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>⏳</span>
              <span>El efecto se activa automáticamente cuando empieza la adivinación</span>
            </div>
          )}

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
                <span style={{ color: 'var(--c-muted)', fontSize: 12 }}>
                  {isClueGiving ? 'Se descuenta ahora, efecto en guessing' : 'Se descuenta al activar'}
                </span>
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
              onClick={handleAction}
              disabled={needsTarget && !selectedTarget}
              style={{ background: `linear-gradient(135deg, ${color}, ${color}aa)` }}
            >
              {actionLabel}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
