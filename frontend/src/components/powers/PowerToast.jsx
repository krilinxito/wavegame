import { useState, useEffect, useCallback } from 'react';
import { playSfx } from '../../utils/sound';
import { motion, AnimatePresence } from 'framer-motion';
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

const QUARTILE_LABELS = ['extremo izquierdo', 'mitad izquierda', 'mitad derecha', 'extremo derecho'];

function buildMessage(powerName, activatorName, targetName, isMyAction, isTargetedAtMe, quartile) {
  const icon = POWER_ICONS[powerName] || '✨';

  if (powerName === 'cuartiles') {
    if (quartile != null) {
      return {
        icon,
        text: `Cuartil ${quartile + 1}/4 — ${QUARTILE_LABELS[quartile]}`,
        subtext: 'Tu poder de cuartiles se activó',
        personal: true,
      };
    }
    return {
      icon,
      text: 'Alguien usó cuartiles',
      subtext: 'Reveló el cuartil del target (solo para ellos)',
    };
  }

  if (powerName === 'escudo') {
    return {
      icon,
      text: 'Activaste escudo',
      subtext: 'Si fallás, tu penalidad será 0',
      personal: true,
    };
  }

  if (powerName === 'veneno') {
    if (isTargetedAtMe) {
      return {
        icon,
        text: 'Alguien te envenenó',
        subtext: '−3 puntos extra si fallás',
        danger: true,
      };
    }
    if (isMyAction) {
      return { icon, text: 'Tiraste veneno', subtext: '−3 pts extra si falla' };
    }
    return { icon, text: 'Alguien tiró veneno' };
  }

  if (powerName === 'bloqueo') {
    if (isTargetedAtMe) {
      return {
        icon,
        text: 'Alguien te bloqueó',
        subtext: 'No podés adivinar esta ronda',
        danger: true,
      };
    }
    if (isMyAction) {
      return { icon, text: 'Bloqueaste a alguien', subtext: 'No puede adivinar esta ronda' };
    }
    return { icon, text: 'Alguien bloqueó a alguien' };
  }

  if (powerName === 'switch') {
    if (isTargetedAtMe) {
      return {
        icon,
        text: 'Alguien va a hacer switch con vos',
        subtext: 'Se intercambian posiciones al revelar',
        warning: true,
      };
    }
    if (isMyAction) {
      return { icon, text: 'Hiciste switch con alguien', subtext: 'Intercambian posiciones al revelar' };
    }
    return { icon, text: 'Alguien hizo switch' };
  }

  return { icon, text: `Alguien usó ${powerName}` };
}

// Overlay flash when YOU are targeted
function HitFlash({ powerName }) {
  const color = POWER_COLORS[powerName] || '#ef4444';
  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: `radial-gradient(ellipse at center, ${color}55 0%, ${color}22 50%, transparent 75%)`,
        pointerEvents: 'none',
      }}
    />
  );
}

export default function PowerToast() {
  const [toasts, setToasts] = useState([]);
  const [hits, setHits] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 350);
  }, []);

  useEffect(() => {
    const handler = (data) => {
      const { powerName, activatorId, effect } = data;
      const { players, myPlayer } = useGameStore.getState();

      const activator = players.find(p => p.id === activatorId);
      const target = effect?.targetId ? players.find(p => p.id === effect.targetId) : null;
      const isMyAction = activatorId === myPlayer?.id;
      const isTargetedAtMe = !!effect?.targetId && effect.targetId === myPlayer?.id;
      const quartile = effect?.quartile ?? null;

      // Skip if it's a private event for someone else (shouldn't happen, but guard)
      if (effect?.private && !isMyAction && quartile == null) {
        // Others see the anonymous cuartiles toast (no quartile number)
      }

      const msg = buildMessage(powerName, activator?.display_name ?? '?', target?.display_name ?? '?', isMyAction, isTargetedAtMe, quartile);
      const id = `${Date.now()}-${Math.random()}`;

      const POWER_SFX = { cuartiles: 'sfx_cuartiles', veneno: 'sfx_veneno', escudo: 'sfx_escudo', bloqueo: 'sfx_bloqueo', switch: 'sfx_switch' };
      if ((isMyAction || isTargetedAtMe) && POWER_SFX[powerName]) {
        playSfx(POWER_SFX[powerName]);
      }

      setToasts(prev => [...prev.slice(-3), { id, powerName, msg, isTargetedAtMe, leaving: false }]);

      // Show hit flash for danger/warning powers
      if (isTargetedAtMe && (powerName === 'veneno' || powerName === 'bloqueo' || powerName === 'switch')) {
        const hitId = `hit-${id}`;
        setHits(prev => [...prev, { id: hitId, powerName }]);
        setTimeout(() => setHits(prev => prev.filter(h => h.id !== hitId)), 1500);
      }

      // Auto-dismiss toast
      const ttl = isTargetedAtMe ? 5000 : 3500;
      setTimeout(() => dismiss(id), ttl);
    };

    socket.on('power_activated', handler);
    return () => socket.off('power_activated', handler);
  }, [dismiss]);

  return (
    <>
      {/* Hit flashes */}
      <AnimatePresence>
        {hits.map(h => <HitFlash key={h.id} powerName={h.powerName} />)}
      </AnimatePresence>

      {/* Toast stack — fluye en el documento donde se renderice */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        marginTop: toasts.length ? 12 : 0,
      }}>
        <AnimatePresence>
          {toasts.map(({ id, powerName, msg, isTargetedAtMe }) => {
            const color = POWER_COLORS[powerName] || '#7c3aed';
            const borderColor = msg.danger ? '#ef4444' : msg.warning ? '#f97316' : msg.personal ? color : `${color}66`;
            const bgColor = msg.danger ? 'rgba(239,68,68,0.15)' : msg.warning ? 'rgba(249,115,22,0.12)' : `${color}18`;

            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, x: 60, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                onClick={() => dismiss(id)}
              >
                <div style={{
                  background: bgColor,
                  border: `1.5px solid ${borderColor}`,
                  borderRadius: 14,
                  padding: '10px 14px',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  cursor: 'pointer',
                  boxShadow: msg.danger || msg.warning
                    ? `0 4px 20px ${borderColor}44`
                    : '0 2px 12px rgba(0,0,0,0.3)',
                }}>
                  <span style={{ fontSize: 22, lineHeight: 1, marginTop: 1 }}>{msg.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'Nunito, sans-serif',
                      fontWeight: 700,
                      fontSize: 13,
                      color: msg.danger ? '#ef4444' : msg.warning ? '#f97316' : 'var(--c-text)',
                      lineHeight: 1.3,
                    }}>
                      {msg.text}
                    </div>
                    {msg.subtext && (
                      <div style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 2 }}>
                        {msg.subtext}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
}
