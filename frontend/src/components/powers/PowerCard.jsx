import React, { useState, useEffect } from 'react';
import { playSfx } from '../../utils/sound';
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

function EmptySlot() {
  return (
    <div style={{
      width: 68, height: 80,
      border: '2px dashed rgba(255,255,255,0.1)',
      borderRadius: 14,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: 0.3,
    }}>
      <span style={{ fontSize: 18, opacity: 0.4 }}>✦</span>
    </div>
  );
}

function PowerSlot({ power, isFree, purchased, queued, alreadyUsed, isClueGiving, onClick }) {
  const [hovered, setHovered] = useState(false);
  const color = POWER_COLORS[power.name] || '#7c3aed';
  const icon  = POWER_ICONS[power.name]  || '✨';

  let hoverLabel = '';
  if (!alreadyUsed) {
    if (!purchased) hoverLabel = isFree ? 'Canjear gratis' : 'Comprar';
    else if (queued)  hoverLabel = '⏳ Reservado';
    else              hoverLabel = isClueGiving ? 'Reservar' : 'Usar';
  }

  // Badge content (rendered outside the button to avoid overflow:hidden clipping)
  let badge = null;
  if (isFree && !purchased && !alreadyUsed)
    badge = <span style={{ background: '#fbbf24', color: '#000', fontSize: 8, fontWeight: 800, borderRadius: 6, padding: '1px 4px' }}>FREE</span>;
  else if (queued)
    badge = <span style={{ background: color, color: '#fff', fontSize: 9, fontWeight: 800, borderRadius: 6, padding: '1px 4px' }}>⏳</span>;
  else if (alreadyUsed)
    badge = <span style={{ background: 'rgba(255,255,255,0.15)', color: 'var(--c-muted)', fontSize: 8, fontWeight: 700, borderRadius: 6, padding: '1px 4px' }}>✓</span>;
  else if (purchased)
    badge = <span style={{ background: color, color: '#fff', fontSize: 8, fontWeight: 800, borderRadius: 6, padding: '1px 5px' }}>✔</span>;

  return (
    // Wrapper div handles the badge overflow outside the button
    <div style={{ position: 'relative', width: 68, height: 80 }}>
      <motion.button
        whileHover={alreadyUsed ? {} : { scale: 1.06 }}
        whileTap={alreadyUsed   ? {} : { scale: 0.94 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={alreadyUsed || queued ? undefined : onClick}
        style={{
          width: '100%', height: '100%',
          background: alreadyUsed
            ? 'rgba(255,255,255,0.04)'
            : purchased
              ? `linear-gradient(145deg, ${color}44, ${color}22)`
              : `linear-gradient(145deg, ${color}33, ${color}18)`,
          border: `2px solid ${
            alreadyUsed ? 'rgba(255,255,255,0.1)'
            : queued     ? `${color}88`
            : purchased  ? color
            :              `${color}88`
          }`,
          borderRadius: 14,
          cursor: alreadyUsed || queued ? 'default' : 'pointer',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 3,
          padding: '6px 4px 4px',
          position: 'relative',
          opacity: alreadyUsed ? 0.4 : 1,
          boxShadow: alreadyUsed || queued ? 'none'
            : purchased ? `0 4px 20px ${color}55`
            : `0 2px 12px ${color}22`,
          overflow: 'hidden',
        }}
      >
        <span style={{ fontSize: 28, lineHeight: 1 }}>{icon}</span>
        <span style={{
          fontFamily: 'Fredoka One', fontSize: 10,
          color: alreadyUsed ? 'var(--c-muted)' : '#fff',
          textAlign: 'center', lineHeight: 1.1,
          maxWidth: 60, padding: '0 2px',
        }}>
          {power.name}
        </span>

        {/* Price tag (bottom left, shown if not purchased) */}
        {!purchased && !alreadyUsed && (
          <span style={{
            position: 'absolute', bottom: 4, left: 4,
            fontSize: 9, fontFamily: 'Fredoka One',
            color: isFree ? '#fbbf24' : `${color}dd`,
          }}>
            {isFree ? 'FREE' : `${power.cost}p`}
          </span>
        )}

        {/* Hover overlay */}
        <AnimatePresence>
          {hovered && hoverLabel && !alreadyUsed && !queued && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute', inset: 0,
                background: `${color}cc`,
                borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800,
                color: '#fff', textAlign: 'center',
                padding: '0 4px', lineHeight: 1.2,
              }}
            >
              {hoverLabel}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Badge fuera del botón para no ser cortado por overflow:hidden */}
      {badge && (
        <div style={{ position: 'absolute', top: -6, right: -6, zIndex: 1 }}>
          {badge}
        </div>
      )}
    </div>
  );
}

export default function PowerCard() {
  const { myPower, myPowerPurchased, myPowerQueued, activePowers, players, myPlayer, round, game } = useGameStore();
  const [open, setOpen]             = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [used, setUsed]             = useState(false);

  useEffect(() => {
    setUsed(false);
    setSelectedTarget(null);
  }, [myPower?.roundPowerId]);

  if (game?.mode === 'teams') return null;
  if (round?.status !== 'guessing' && round?.status !== 'clue_giving') return null;

  const isClueGiving  = round?.status === 'clue_giving';
  const hasPower      = myPower && myPower.power !== null;
  const { roundPowerId, power, isFree } = hasPower ? myPower : {};

  const alreadyUsedThisRound = hasPower && activePowers.some(p => p.powerName === power.name);
  const isQueued  = myPowerQueued && isClueGiving;
  const isDone    = (myPowerQueued && !isClueGiving) || used;

  const needsTarget = hasPower && ['veneno', 'bloqueo', 'switch'].includes(power.name);
  const color       = hasPower ? (POWER_COLORS[power.name] || '#7c3aed') : '#7c3aed';

  const eligibleTargets = players.filter(p =>
    p.id !== myPlayer?.id &&
    p.id !== round?.psychic_id &&
    p.connected
  );

  // Step 1: Buy (pay cost, claim to inventory)
  const handleBuy = () => {
    playSfx('sfx_power_buy');
    socket.emit('purchase_power', { roundPowerId, isFree: !!isFree });
    setOpen(false);
  };

  // Step 2: Use / Reserve (apply effect)
  const handleUse = () => {
    if (needsTarget && !selectedTarget) return;
    if (isClueGiving) {
      socket.emit('queue_power', {
        roundPowerId,
        targetPlayerId: selectedTarget || null,
        isFree: true, // ya fue pagado en comprar
      });
      setOpen(false);
    } else {
      socket.emit('activate_power', {
        roundPowerId,
        targetPlayerId: selectedTarget || null,
        isFree: true, // ya fue pagado en comprar
      });
      setUsed(true);
      setOpen(false);
    }
  };

  const slots = Array.from({ length: SLOTS }, (_, i) => {
    if (i === 0 && hasPower && !isDone) {
      return {
        type: 'power',
        power, isFree, purchased: myPowerPurchased,
        queued: isQueued, alreadyUsed: alreadyUsedThisRound,
      };
    }
    return { type: 'empty' };
  });

  // Modal content depends on step
  const isStep1 = !myPowerPurchased; // comprar
  const actionLabel = isStep1 ? (isFree ? 'Canjear gratis' : 'Comprar') : isClueGiving ? 'Reservar' : 'Usar';

  return (
    <>
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
                purchased={slot.purchased}
                queued={slot.queued}
                alreadyUsed={slot.alreadyUsed}
                isClueGiving={isClueGiving}
                onClick={() => setOpen(true)}
              />
            ) : (
              <EmptySlot key={i} />
            )
          )}
        </div>

        {isQueued && (
          <div style={{ fontSize: 10, color, textAlign: 'center', marginTop: -2 }}>
            ⏳ se activa al adivinar
          </div>
        )}
      </motion.div>

      {hasPower && !isDone && (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title={`${POWER_ICONS[power.name] || '✨'} ${power.name}`}
        >
          <p style={{ color: 'var(--c-muted)', fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>
            {power.description}
          </p>

          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {['Comprar', 'Usar'].map((step, i) => {
              const active = isStep1 ? i === 0 : i === 1;
              const done   = !isStep1 && i === 0;
              return (
                <div key={i} style={{
                  flex: 1, padding: '6px 8px', borderRadius: 8, textAlign: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: done ? `${color}22` : active ? `${color}33` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${done || active ? color : 'rgba(255,255,255,0.08)'}`,
                  color: done ? `${color}88` : active ? color : 'var(--c-muted)',
                }}>
                  {done ? `✓ ${step}` : `${i + 1}. ${step}`}
                </div>
              );
            })}
          </div>

          {/* Step 1: buy info */}
          {isStep1 && (
            <div style={{ background: isFree ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.05)', border: isFree ? '1px solid #fbbf2444' : 'none', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 14 }}>
              {isFree ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🎯</span>
                  <span style={{ fontFamily: 'Fredoka One', color: '#fbbf24', fontSize: 16 }}>¡Poder gratis por bullseye!</span>
                </span>
              ) : (
                <>
                  <span style={{ color: 'var(--c-muted)' }}>Costo: </span>
                  <span style={{ fontFamily: 'Fredoka One', color, fontSize: 20 }}>{power.cost} pts</span>
                  <span style={{ color: 'var(--c-muted)', fontSize: 12, marginLeft: 8 }}>
                    — se guardan en tu inventario
                  </span>
                </>
              )}
            </div>
          )}

          {/* Step 2: use info + target */}
          {!isStep1 && (
            <>
              {isClueGiving && (
                <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--c-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>⏳</span>
                  <span>El efecto se activará automáticamente cuando empiece la adivinación</span>
                </div>
              )}
              {needsTarget && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 13, color: 'var(--c-muted)', marginBottom: 10 }}>Elegí un jugador:</p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {eligibleTargets.map(p => (
                      <motion.button
                        key={p.id}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
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
            </>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={isStep1 ? handleBuy : handleUse}
              disabled={!isStep1 && needsTarget && !selectedTarget}
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
