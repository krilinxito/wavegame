import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SpectrumDial from '../spectrum/SpectrumDial';
import Button from '../shared/Button';
import Timer from '../shared/Timer';
import socket from '../../socket';
import useGameStore from '../../store/gameStore';
import { slideUp } from '../../animations/variants';

export default function Guessing() {
  const { round, category, myPlayer, players, activePowers, game, submittedGuesses } = useGameStore();
  const [guessPct, setGuessPct] = useState(0.5);
  const [submitted, setSubmitted] = useState(false);

  const isPsychic = round?.psychic_id === myPlayer?.id;
  const isSpectator = !!myPlayer?.is_spectator;
  const isBlocked = activePowers.some(p => p.powerName === 'bloqueo' && p.effect?.targetId === myPlayer?.id);

  const cuartilesPower = activePowers.find(p => p.powerName === 'cuartiles' && p.activatorId === myPlayer?.id);
  const showQuartile = cuartilesPower?.effect?.quartile ?? null;

  const submitGuess = (pct) => {
    if (submitted || isPsychic || isBlocked || isSpectator) return;
    const finalPct = pct ?? guessPct;
    socket.emit('submit_guess', { roundId: round.id, guessPct: finalPct });
    setSubmitted(true);
  };

  const handleTimerExpire = () => {
    if (!submitted && !isPsychic && !isBlocked) {
      submitGuess(guessPct);
    }
    // If host, also trigger reveal
    if (!!myPlayer?.is_host) {
      socket.emit('request_reveal', { roundId: round.id });
    }
  };

  const isBasta = game?.mode === 'basta';
  const nonPsychicPlayers = players.filter(p => p.id !== round?.psychic_id);
  const submittedCount = submittedGuesses.length;

  // Ref always points to latest submitGuess — evita closure stale
  const submitGuessRef = useRef(null);
  submitGuessRef.current = submitGuess;

  // Spacebar triggers basta submit (un solo listener estable)
  useEffect(() => {
    if (!isBasta) return;
    const onKey = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        submitGuessRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isBasta]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
      <motion.div {...slideUp} style={{ textAlign: 'center', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--c-muted)', fontWeight: 600 }}>
            RONDA {round?.round_number} · ADIVINANZA
            {isBasta && <span style={{ color: '#fbbf24', marginLeft: 8 }}>⚡ BASTA</span>}
          </div>
          <Timer seconds={game?.guess_time || 120} onExpire={handleTimerExpire} />
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12, padding: '10px 20px',
          fontFamily: 'Fredoka One', fontSize: 22, color: 'var(--c-text)',
        }}>
          "{round?.clue}"
        </div>
        <div style={{ fontSize: 13, color: 'var(--c-muted)', marginTop: 6 }}>
          dijo <strong style={{ color: 'var(--c-text)' }}>{round?.psychicName}</strong>
          <span style={{ marginLeft: 12, color: 'var(--c-muted)' }}>
            {submittedCount}/{nonPsychicPlayers.length} adivinaron
          </span>
        </div>
      </motion.div>

      <SpectrumDial
        category={category}
        players={players}
        submittedGuesses={submittedGuesses}
        guessPct={guessPct}
        onGuessChange={setGuessPct}
        showGuessHandle={!isPsychic && !submitted && !isBlocked && !isSpectator}
        showQuartile={showQuartile}
      />


      {isPsychic && (
        <div style={{ color: 'var(--c-muted)', fontSize: 15 }}>Sos el Psychic — no podés adivinar</div>
      )}

      {isSpectator && (
        <div style={{ color: 'var(--c-muted)', fontSize: 15 }}>👁 Estás especteando esta ronda</div>
      )}

      {isBlocked && !isPsychic && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '12px 24px', color: '#ef4444', fontWeight: 700 }}
        >
          🚫 Estás bloqueado esta ronda
        </motion.div>
      )}

      {!isPsychic && !isBlocked && (
        <AnimatePresence>
          {!submitted ? (
            <motion.div key="submit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
            >
              {isBasta && (
                <p style={{ color: '#fbbf24', fontSize: 13, fontWeight: 700 }}>
                  ⚡ El primero en adivinar es el único que puede ganar puntos
                </p>
              )}
              <Button onClick={() => submitGuess()} size="lg">
                {isBasta ? '⚡ ¡BASTA! Confirmar' : 'Confirmar adivinanza'}
              </Button>
              <p style={{ color: 'var(--c-muted)', fontSize: 12 }}>
                {isBasta ? 'Click o Espacio para cantar BASTA' : 'Arrastrá la aguja y confirmá tu posición'}
              </p>
            </motion.div>
          ) : (
            <motion.div key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ color: '#10b981', fontWeight: 700, fontSize: 16 }}
            >
              ✓ Adivinanza enviada
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
