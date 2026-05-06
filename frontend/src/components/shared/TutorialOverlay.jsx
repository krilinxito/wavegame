import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '../../context/SettingsContext';
import Button from './Button';

// Phase timings in ms
const PHASES = [
  { duration: 2000 },  // 0: spectrum appears
  { duration: 2000 },  // 1: clue appears
  { duration: 2500 },  // 2: players guess
  { duration: 2500 },  // 3: reveal
];
const TOTAL = PHASES.reduce((s, p) => s + p.duration, 0);

const MOCK_PLAYERS = [
  { color: '#6c63ff', label: 'A', targetPct: 0.70, score: '+4' },
  { color: '#f97316', label: 'B', targetPct: 0.58, score: '+3' },
  { color: '#10b981', label: 'C', targetPct: 0.42, score: '-2' },
];
const TARGET_PCT = 0.72;

const TEXT = {
  es: [
    ['🧠 El psíquico conoce el objetivo secreto', 'Los demás solo ven el espectro'],
    ['💬 Da una pista para guiar a los demás', 'Una sola pista para todo el espectro'],
    ['🎯 Los demás mueven el dial donde creen', 'Cuanto más cerca del objetivo, mejor'],
    ['✨ ¡Se revelan los resultados!', 'Bullseye = +4 · Cerca = +3 · Casi = +2'],
  ],
  en: [
    ['🧠 The psychic knows the secret target', 'Others only see the spectrum'],
    ['💬 Give a clue to guide everyone', 'One single clue for the whole spectrum'],
    ['🎯 Others move the dial to their guess', 'Closer to the target = more points'],
    ['✨ Results revealed!', 'Bullseye = +4 · Close = +3 · Near = +2'],
  ],
};

function DialDemo({ phase }) {
  // SVG arc from 0° (left) to 180° (right), center at (0,0), radius 80
  const R = 80;
  const arc = `M ${-R} 0 A ${R} ${R} 0 0 1 ${R} 0`;
  const pctToX = (p) => R * Math.cos(Math.PI * (1 - p));
  const pctToY = (p) => -R * Math.sin(Math.PI * (1 - p));

  const targetX = pctToX(TARGET_PCT);
  const targetY = pctToY(TARGET_PCT);

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 340 }}>
      <svg viewBox="-110 -95 220 110" style={{ width: '100%', overflow: 'visible' }}>
        {/* Track */}
        <path d={arc} fill="none" stroke="var(--c-border2)" strokeWidth={14} strokeLinecap="round" />

        {/* Scoring zones (visible from phase 3) */}
        <AnimatePresence>
          {phase >= 3 && (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {[{ hw: 0.10, color: '#fbbf24', op: 0.3 }, { hw: 0.05, color: '#f97316', op: 0.5 }, { hw: 0.02, color: '#ef4444', op: 0.9 }].map((z, i) => {
                const a1 = Math.PI * (1 - (TARGET_PCT - z.hw));
                const a2 = Math.PI * (1 - (TARGET_PCT + z.hw));
                const x1 = R * Math.cos(a1), y1 = -R * Math.sin(a1);
                const x2 = R * Math.cos(a2), y2 = -R * Math.sin(a2);
                return (
                  <path key={i}
                    d={`M ${x1} ${y1} A ${R} ${R} 0 0 0 ${x2} ${y2}`}
                    fill="none" stroke={z.color} strokeWidth={14} strokeOpacity={z.op} strokeLinecap="round"
                  />
                );
              })}
            </motion.g>
          )}
        </AnimatePresence>

        {/* Target marker (phase 3+) */}
        <AnimatePresence>
          {phase >= 3 && (
            <motion.circle cx={targetX} cy={targetY} r={7}
              fill="#ef4444" stroke="#fff" strokeWidth={2}
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            />
          )}
        </AnimatePresence>

        {/* Player handles (phase 2+) */}
        {MOCK_PLAYERS.map((p, i) => (
          <AnimatePresence key={i}>
            {phase >= 2 && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.25 }}
              >
                <motion.circle
                  cx={pctToX(0.5)} cy={pctToY(0.5)}
                  animate={{ cx: pctToX(p.targetPct), cy: pctToY(p.targetPct) }}
                  transition={{ type: 'spring', stiffness: 60, damping: 14, delay: i * 0.25 }}
                  r={9} fill={p.color} stroke="#fff" strokeWidth={2}
                />
                {phase >= 3 && (
                  <motion.text
                    x={pctToX(p.targetPct)} y={pctToY(p.targetPct) - 15}
                    textAnchor="middle" fontSize={10} fontWeight={700}
                    fill={parseFloat(p.score) > 0 ? '#10b981' : '#ef4444'}
                    initial={{ opacity: 0, y: pctToY(p.targetPct) - 8 }}
                    animate={{ opacity: 1, y: pctToY(p.targetPct) - 15 }}
                    transition={{ delay: 0.4 + i * 0.15 }}
                  >{p.score}</motion.text>
                )}
              </motion.g>
            )}
          </AnimatePresence>
        ))}

        {/* Extremes */}
        <text x={-R - 4} y={12} textAnchor="end" fontSize={9} fill="var(--c-muted)">Frío</text>
        <text x={R + 4}  y={12} textAnchor="start" fontSize={9} fill="var(--c-muted)">Caliente</text>

        {/* Category */}
        <text x={0} y={-82} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--c-text)">Temperatura</text>
      </svg>

      {/* Clue badge (phase 1+) */}
      <AnimatePresence>
        {phase >= 1 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{
              position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
              background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
              borderRadius: 8, padding: '5px 14px', fontSize: 14, fontWeight: 700,
              color: 'var(--c-accent2)', whiteSpace: 'nowrap',
            }}
          >
            🌋 Volcán
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TutorialOverlay({ onClose }) {
  const { lang } = useSettings();
  const texts = TEXT[lang] ?? TEXT.es;
  const [phase, setPhase] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(e => {
        const next = (e + 100) % TOTAL;
        let acc = 0;
        for (let i = 0; i < PHASES.length; i++) {
          acc += PHASES[i].duration;
          if (next < acc) { setPhase(i); break; }
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Progress bar fill
  let phaseStart = 0;
  for (let i = 0; i < phase; i++) phaseStart += PHASES[i].duration;
  const phaseProgress = ((elapsed - phaseStart + TOTAL) % TOTAL) / PHASES[phase].duration;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border2)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: 420, overflow: 'hidden', boxShadow: 'var(--shadow-window)' }}
      >
        {/* Phase progress bar */}
        <div style={{ height: 3, background: 'var(--c-surface2)' }}>
          <motion.div
            style={{ height: '100%', background: 'var(--c-accent2)', width: `${phaseProgress * 100}%` }}
          />
        </div>

        <div style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {/* Text */}
          <AnimatePresence mode="wait">
            <motion.div key={phase} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              style={{ textAlign: 'center', minHeight: 44 }}>
              <div style={{ fontFamily: 'Fredoka One', fontSize: 17, color: 'var(--c-text)', marginBottom: 4 }}>
                {texts[phase][0]}
              </div>
              <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>{texts[phase][1]}</div>
            </motion.div>
          </AnimatePresence>

          {/* Animated dial */}
          <DialDemo phase={phase} />

          {/* Phase dots */}
          <div style={{ display: 'flex', gap: 6 }}>
            {PHASES.map((_, i) => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === phase ? 'var(--c-accent2)' : 'var(--c-border2)', transition: 'background 0.3s' }} />
            ))}
          </div>

          <Button onClick={onClose} style={{ width: '100%' }}>
            {lang === 'en' ? '✓ Got it, let\'s play!' : '✓ ¡Entendido, a jugar!'}
          </Button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-muted)', fontSize: 12, fontFamily: 'Nunito, sans-serif' }}>
            {lang === 'en' ? 'Skip' : 'Saltar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
