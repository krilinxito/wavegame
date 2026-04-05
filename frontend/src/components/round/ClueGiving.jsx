import React, { useState } from 'react';
import { motion } from 'framer-motion';
import SpectrumDial from '../spectrum/SpectrumDial';
import Button from '../shared/Button';
import Timer from '../shared/Timer';
import socket from '../../socket';
import useGameStore from '../../store/gameStore';
import { slideUp } from '../../animations/variants';

export default function ClueGiving() {
  const { round, category, myPlayer, players } = useGameStore();
  const [clue, setClue] = useState('');

  const isPsychic = round?.psychic_id === myPlayer?.id;

  const submitClue = (text) => {
    const val = (text ?? clue).trim();
    if (!val) return;
    socket.emit('submit_clue', { roundId: round.id, clue: val });
  };

  const handleTimerExpire = () => {
    if (isPsychic && !clue.trim()) {
      submitClue('...');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
      <motion.div {...slideUp} style={{ textAlign: 'center', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--c-muted)', fontWeight: 600 }}>
            RONDA {round?.round_number}
          </div>
          <Timer seconds={120} onExpire={handleTimerExpire} />
        </div>
        <h1 style={{ fontFamily: 'Fredoka One', fontSize: 28, background: 'linear-gradient(135deg, #7c3aed, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {isPsychic ? '¡Sos el Psychic!' : `${round?.psychicName || 'El Psychic'} está pensando...`}
        </h1>
      </motion.div>

      <SpectrumDial
        targetPct={isPsychic ? round?.targetPct : null}
        category={category}
        players={players}
        isPsychic={isPsychic}
      />

      {isPsychic ? (
        <motion.div {...slideUp} style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ color: 'var(--c-muted)', fontSize: 14, textAlign: 'center' }}>
            Dá una pista que ubique el espectro en <strong style={{ color: 'var(--c-text)' }}>{category?.term}</strong>
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={clue}
              onChange={e => setClue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitClue()}
              placeholder="Tu pista..."
              maxLength={255}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.07)',
                border: '2px solid rgba(124,58,237,0.4)',
                borderRadius: 12,
                padding: '12px 16px',
                color: 'var(--c-text)',
                fontSize: 16,
                outline: 'none',
              }}
            />
            <Button onClick={() => submitClue()} disabled={!clue.trim()}>Enviar</Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          style={{ color: 'var(--c-muted)', fontSize: 15, fontWeight: 600 }}
        >
          Esperando la pista del Psychic...
        </motion.div>
      )}
    </div>
  );
}
