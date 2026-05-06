import React, { useState } from 'react';
import { motion } from 'framer-motion';
import SpectrumDial from '../spectrum/SpectrumDial';
import Button from '../shared/Button';
import Timer from '../shared/Timer';
import socket from '../../socket';
import useGameStore from '../../store/gameStore';
import { slideUp } from '../../animations/variants';
import { useLang } from '../../hooks/useLang';
import { useSettings } from '../../context/SettingsContext';

export default function ClueGiving() {
  const L = useLang();
  const { lang } = useSettings();
  const { round, category, myPlayer, players, skipVotes } = useGameStore();
  const [clue, setClue] = useState('');

  const isPsychic = round?.psychic_id === myPlayer?.id;
  const activeCount = players.filter(p => !p.is_spectator).length;
  const myVoted = skipVotes?.includes(myPlayer?.id);

  const voteSkip = () => socket.emit('vote_skip_category', { roundId: round.id });

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

  const challenge = round?.challenge;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
      {challenge && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 10, padding: '8px 16px', textAlign: 'center', maxWidth: 400, width: '100%' }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
            🎲 {lang === 'en' ? 'Challenge' : 'Reto'}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--c-text)' }}>{lang === 'en' ? (challenge.nameEn || challenge.name) : challenge.name}</div>
          <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>{lang === 'en' ? (challenge.descriptionEn || challenge.description) : challenge.description}</div>
        </motion.div>
      )}
      <motion.div {...slideUp} style={{ textAlign: 'center', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--c-muted)', fontWeight: 600 }}>
            {L.roundLabel2(round?.round_number)}
          </div>
          <Timer seconds={120} onExpire={handleTimerExpire} />
        </div>
        <h1 style={{ fontFamily: 'Fredoka One', fontSize: 28, background: 'linear-gradient(135deg, #7c3aed, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {isPsychic ? L.youArePsychic : L.psychicThinking(round?.psychicName || 'Psychic')}
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
            {L.clueHint(category?.term)}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={clue}
              onChange={e => setClue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitClue()}
              placeholder={L.cluePlaceholder}
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
            <Button onClick={() => submitClue()} disabled={!clue.trim()}>{L.send}</Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          style={{ color: 'var(--c-muted)', fontSize: 15, fontWeight: 600 }}
        >
          {L.waitingClue}
        </motion.div>
      )}

      {!myPlayer?.is_spectator && (
        <motion.div {...slideUp} style={{ textAlign: 'center' }}>
          <button
            onClick={voteSkip}
            style={{
              background: myVoted ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.05)',
              border: `1.5px solid ${myVoted ? '#7c3aed' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 10,
              padding: '6px 14px',
              color: myVoted ? '#a78bfa' : 'var(--c-muted)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              transition: 'all 0.15s',
            }}
          >
            {myVoted ? L.skipVoted : L.voteSkip}
            {' '}
            <span style={{ color: (skipVotes?.length ?? 0) > 0 ? '#7c3aed' : 'var(--c-muted)', fontWeight: 700 }}>
              {skipVotes?.length ?? 0}/{activeCount}
            </span>
          </button>
        </motion.div>
      )}
    </div>
  );
}
