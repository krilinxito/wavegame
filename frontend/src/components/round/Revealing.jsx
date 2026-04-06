import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import SpectrumDial from '../spectrum/SpectrumDial';
import useGameStore from '../../store/gameStore';
import { getPlayerColor } from '../shared/PlayerAvatar';

const REASON_LABELS = {
  psychic_good_clue: { label: '🧠 Buena pista', color: '#10b981' },
  psychic_no_hits:   { label: '💀 Nadie adivinó', color: '#ef4444' },
  bullseye:            { label: '🎯 Bullseye!', color: '#ef4444' },
  close:               { label: '🔥 Cerca',     color: '#f97316' },
  near:                { label: '✓ Cerca',       color: '#fbbf24' },
  miss:                { label: '✗ Errado',      color: '#6b7280' },
  miss_escudo:         { label: '🛡️ Escudo',    color: '#3b82f6' },
  miss_penalty:        { label: '⚠️ Penalidad', color: '#ef4444' },
  basta_not_first:     { label: '—',             color: '#6b7280' },
  basta_others_win:    { label: '+1 🎉',         color: '#10b981' },
  cuartiles_bullseye:  { label: '🎯 Cuartil!',  color: '#ef4444' },
  cuartiles_close:     { label: '🔥 Cuartil',   color: '#f97316' },
  cuartiles_hit:       { label: '✓ Cuartil',    color: '#fbbf24' },
  cuartiles_miss:      { label: '✗ Cuartil',    color: '#6b7280' },
  bloqueo_blocked:     { label: '🚫 Bloqueado', color: '#ef4444' },
  veneno_taken:        { label: '☠️ Veneno',    color: '#8b5cf6' },
};

export default function Revealing() {
  const { revealData, players, round, category, game, myPlayer } = useGameStore();

  const guesses = revealData?.guesses ?? [];
  const myResult = guesses.find(g => g.playerId === myPlayer?.id && g.guessPct !== null);

  // Hooks must be before any conditional return
  useEffect(() => {
    if (!revealData || !myResult) return;
    if (myResult.reason === 'bullseye') {
      // Full screen burst for bullseye
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 }, colors: ['#ef4444','#fbbf24','#10b981','#6c63ff'] });
      setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { x: 0.1, y: 0.6 } }), 200);
      setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { x: 0.9, y: 0.6 } }), 400);
    } else if (myResult.reason === 'close' || myResult.reason === 'near') {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 }, colors: ['#fbbf24','#f97316','#10b981'] });
    }
  }, [revealData?.targetPct]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (!revealData) return null;

  const { targetPct, activePowers } = revealData;
  const psychicResult = guesses.find(g => g.playerId === round?.psychic_id && g.guessPct === null);
  const sorted = [...guesses].filter(g => g.guessPct !== null).sort((a, b) => b.scoreDelta - a.scoreDelta);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center' }}
      >
        <div style={{ fontFamily: 'Fredoka One', fontSize: 26, background: 'linear-gradient(135deg, #ef4444, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          ¡Reveal!
        </div>
        {category && (
          <div style={{ fontSize: 14, color: 'var(--c-muted)', marginTop: 4 }}>
            <span style={{ color: 'var(--c-text)', fontWeight: 700 }}>{category.term}</span>
            {' · '}
            <span style={{ fontSize: 12 }}>Categoría de: {players.find(p => p.id === category.created_by)?.display_name}</span>
          </div>
        )}
      </motion.div>

      <SpectrumDial
        category={category}
        players={players}
        revealData={revealData}
      />

      {/* Psychic result */}
      {psychicResult && (() => {
        const psychic = players.find(p => p.id === psychicResult.playerId);
        const color = getPlayerColor(psychicResult.playerId);
        const reason = REASON_LABELS[psychicResult.reason] || { label: psychicResult.reason, color: '#6b7280' };
        return (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            style={{ width: '100%', maxWidth: 480, background: `${color}11`, border: `1px solid ${color}33`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <span style={{ fontSize: 20 }}>🧠</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 700, color }}>{psychic?.display_name}</span>
              <span style={{ color: 'var(--c-muted)', fontSize: 13, marginLeft: 6 }}>Psychic</span>
              <div style={{ fontSize: 12, color: reason.color }}>{reason.label}</div>
            </div>
            <div style={{ fontFamily: 'Fredoka One', fontSize: 24, color: psychicResult.scoreDelta >= 0 ? '#10b981' : '#ef4444' }}>
              {psychicResult.scoreDelta >= 0 ? `+${psychicResult.scoreDelta}` : psychicResult.scoreDelta}
            </div>
          </motion.div>
        );
      })()}

      {/* Scores table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        style={{ width: '100%', maxWidth: 480, background: 'rgba(255,255,255,0.04)', borderRadius: 16, border: '1px solid var(--c-border)', overflow: 'hidden' }}
      >
        {sorted.map((g, i) => {
          const player = players.find(p => p.id === g.playerId);
          const color = getPlayerColor(g.playerId);
          const reason = REASON_LABELS[g.reason] || { label: g.reason, color: '#6b7280' };
          const isMe = g.playerId === myPlayer?.id;

          return (
            <motion.div
              key={g.playerId}
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                background: isMe ? 'rgba(124,58,237,0.1)' : 'transparent',
                borderBottom: i < sorted.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}
            >
              <span style={{ width: 20, fontSize: 12, color: 'var(--c-muted)' }}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--c-text)', fontSize: 15 }}>{player?.display_name}</div>
                <div style={{ fontSize: 12, color: reason.color }}>{reason.label}</div>
              </div>
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ delay: 0.5 + i * 0.1, type: 'spring', stiffness: 300 }}
                style={{
                  fontFamily: 'Fredoka One', fontSize: 24,
                  color: g.scoreDelta >= 0 ? '#10b981' : '#ef4444',
                }}
              >
                {g.scoreDelta >= 0 ? `+${g.scoreDelta}` : g.scoreDelta}
              </motion.div>
            </motion.div>
          );
        })}
      </motion.div>

      {activePowers?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}
          style={{ width: '100%', maxWidth: 480 }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            ⚡ Poderes usados esta ronda
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {activePowers.map((p, i) => {
              const activator = players.find(pl => pl.id === p.activatorId);
              const target = players.find(pl => pl.id === p.effect?.targetId);
              const color = getPlayerColor(p.activatorId);
              const ICONS = { cuartiles: '🔭', veneno: '☠️', escudo: '🛡️', bloqueo: '🚫', switch: '🔄' };
              const LABELS = { cuartiles: 'usó Cuartiles', veneno: 'tiró Veneno a', escudo: 'usó Escudo', bloqueo: 'bloqueó a', switch: 'hizo Switch con' };
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.3 + i * 0.1 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: `${color}11`, border: `1px solid ${color}33`,
                    borderRadius: 10, padding: '8px 14px',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{ICONS[p.powerName] ?? '✨'}</span>
                  <span style={{ fontWeight: 700, color }}>{activator?.display_name ?? '?'}</span>
                  <span style={{ color: 'var(--c-muted)', fontSize: 13 }}>{LABELS[p.powerName] ?? p.powerName}</span>
                  {target && (
                    <span style={{ fontWeight: 700, color: getPlayerColor(target.id) }}>
                      {target.display_name}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
