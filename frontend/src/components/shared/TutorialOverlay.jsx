import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '../../context/SettingsContext';

const R = 80;
const arc = `M ${-R} 0 A ${R} ${R} 0 0 1 ${R} 0`;
const pctToX = (p) => R * Math.cos(Math.PI * (1 - p));
const pctToY = (p) => -R * Math.sin(Math.PI * (1 - p));
const TARGET_PCT = 0.72;

const PLAYERS = [
  { color: '#6c63ff', pct: 0.70, score: '+4' },
  { color: '#f97316', pct: 0.58, score: '+3' },
  { color: '#10b981', pct: 0.42, score: '-2' },
];

const SLIDES = {
  es: [
    { title: '🧠 El psíquico conoce el objetivo', desc: 'Solo él ve la posición secreta en el espectro. Los demás solo ven los extremos.' },
    { title: '💬 Da una pista', desc: 'Una sola palabra o frase para guiar a todos hacia la posición secreta.' },
    { title: '🎯 Los demás mueven el dial', desc: 'Cada jugador arrastra el dial al lugar donde cree que está el objetivo.' },
    { title: '✨ ¡Se revelan los resultados!', desc: 'Bullseye 🎯 = +4 · Cerca 🔥 = +3 · Casi ✓ = +2 · El psíquico gana puntos si aciertan.' },
    { title: '🃏 Las categorías', desc: '', type: 'info', items: [
      'Cada categoría tiene un <b>concepto central</b> y <b>dos extremos opuestos</b>.',
      'Ejemplo: <b>"Temperatura"</b> → extremos <b>Frío</b> y <b>Caliente</b>.',
      'Las mejores son <b>subjetivas y debatibles</b> — sin respuesta obvia.',
      'Evitá extremos que sean hechos objetivos (ej: "Países grandes → Pequeño/Grande" tiene respuesta única).',
      'Tips: animales, películas, canciones, conceptos abstractos, lugares... ¡la creatividad manda!',
    ]},
    { title: '🎮 Modos de juego', desc: '', type: 'info', modes: [
      { name: 'Normal', desc: 'Psychic rotante · poderes activos · gana el primero en llegar al puntaje.' },
      { name: 'Teams', desc: 'Duos · cada pareja tiene su espectro · gana la pareja con más puntos.' },
      { name: 'BASTA ⚡', desc: 'El primero en confirmar es el único que puede ganar puntos esa ronda.' },
    ]},
    { title: '⚡ Poderes', desc: '', type: 'info',
      intro: 'En modo Normal tenés 75% de chance de recibir un poder. Compralo con puntos o ganá uno <b>gratis</b> con Bullseye.',
      powers: [
        { icon: '🔮', name: 'Cuartiles', cost: '3 pts', desc: 'Revela en qué cuartil está el objetivo.' },
        { icon: '☠️', name: 'Veneno',    cost: '3 pts', desc: 'El objetivo pierde 3 pts. Si fallás, tu penalización se duplica.' },
        { icon: '🛡️', name: 'Escudo',   cost: '2 pts', desc: 'Si fallás, no recibís penalización.' },
        { icon: '🚫', name: 'Bloqueo',  cost: '3 pts', desc: 'El objetivo no puede adivinar esta ronda.' },
        { icon: '🔄', name: 'Switch',   cost: '3 pts', desc: 'Intercambia tu posición con la de otro jugador.' },
      ],
    },
  ],
  en: [
    { title: '🧠 The psychic knows the target', desc: 'Only they see the secret position. Others only see the spectrum extremes.' },
    { title: '💬 Give a clue', desc: 'One word or phrase to guide everyone toward the secret position.' },
    { title: '🎯 Others move the dial', desc: 'Each player drags the dial to where they think the target is.' },
    { title: '✨ Results revealed!', desc: 'Bullseye 🎯 = +4 · Close 🔥 = +3 · Near ✓ = +2 · The psychic earns points if others score.' },
    { title: '🃏 Categories', desc: '', type: 'info', items: [
      'Each category has a <b>central concept</b> and <b>two opposite extremes</b>.',
      'Example: <b>"Temperature"</b> → extremes <b>Cold</b> and <b>Hot</b>.',
      'The best ones are <b>subjective and debatable</b> — no obvious answer.',
      'Avoid extremes that are objective facts (e.g. "Big countries → Small/Big" has one answer).',
      'Tips: animals, movies, songs, abstract concepts, places... creativity is key!',
    ]},
    { title: '🎮 Game modes', desc: '', type: 'info', modes: [
      { name: 'Normal', desc: 'Rotating psychic · powers active · first to reach the score goal wins.' },
      { name: 'Teams', desc: 'Pairs · each pair gets their own spectrum · most points wins.' },
      { name: 'BASTA ⚡', desc: 'First to confirm is the only one who can score that round.' },
    ]},
    { title: '⚡ Powers', desc: '', type: 'info',
      intro: 'In Normal mode you have a 75% chance of getting a power offer. Buy it with points or get one <b>for free</b> with Bullseye.',
      powers: [
        { icon: '🔮', name: 'Quartiles', cost: '3 pts', desc: 'Reveals which quartile the target is in.' },
        { icon: '☠️', name: 'Poison',    cost: '3 pts', desc: 'Target loses 3 pts instantly. If you miss, your penalty doubles.' },
        { icon: '🛡️', name: 'Shield',   cost: '2 pts', desc: "If you miss, you don't receive a penalty." },
        { icon: '🚫', name: 'Block',     cost: '3 pts', desc: "Target can't guess this round." },
        { icon: '🔄', name: 'Switch',    cost: '3 pts', desc: "Swaps your guess position with another player's." },
      ],
    },
  ],
};

function DialSlide({ slide }) {
  const showClue    = slide >= 1;
  const showPlayers = slide >= 2;
  const showReveal  = slide >= 3;

  return (
    <div style={{ width: '100%', maxWidth: 320 }}>
      {/* Clue badge — separate row, NEVER overlapping SVG */}
      <div style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}>
        <AnimatePresence>
          {showClue && (
            <motion.div
              key="clue"
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              style={{
                background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
                borderRadius: 8, padding: '5px 16px',
                fontSize: 15, fontWeight: 700, color: 'var(--c-accent2)',
              }}
            >
              🌋 Volcán
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <svg viewBox="-100 -88 200 105" style={{ width: '100%', overflow: 'visible' }}>
        {/* Track */}
        <path d={arc} fill="none" stroke="var(--c-border2)" strokeWidth={14} strokeLinecap="round" />

        {/* Scoring zones */}
        <AnimatePresence>
          {showReveal && [
            { hw: 0.10, color: '#fbbf24', op: 0.3 },
            { hw: 0.05, color: '#f97316', op: 0.5 },
            { hw: 0.02, color: '#ef4444', op: 0.9 },
          ].map((z, i) => {
            const a1 = Math.PI * (1 - (TARGET_PCT - z.hw));
            const a2 = Math.PI * (1 - (TARGET_PCT + z.hw));
            const x1 = R * Math.cos(a1), y1 = -R * Math.sin(a1);
            const x2 = R * Math.cos(a2), y2 = -R * Math.sin(a2);
            return (
              <motion.path key={i}
                d={`M ${x1} ${y1} A ${R} ${R} 0 0 0 ${x2} ${y2}`}
                fill="none" stroke={z.color} strokeWidth={14} strokeOpacity={z.op} strokeLinecap="round"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              />
            );
          })}
        </AnimatePresence>

        {/* Target marker */}
        <AnimatePresence>
          {showReveal && (
            <motion.circle
              cx={pctToX(TARGET_PCT)} cy={pctToY(TARGET_PCT)} r={7}
              fill="#ef4444" stroke="#fff" strokeWidth={2}
              initial={{ scale: 0 }} animate={{ scale: 1 }}
            />
          )}
        </AnimatePresence>

        {/* Player handles */}
        <AnimatePresence>
          {showPlayers && PLAYERS.map((p, i) => (
            <motion.g key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }}>
              <circle cx={pctToX(p.pct)} cy={pctToY(p.pct)} r={9} fill={p.color} stroke="#fff" strokeWidth={2} />
              {showReveal && (
                <motion.text
                  x={pctToX(p.pct)} y={pctToY(p.pct) - 14}
                  textAnchor="middle" fontSize={10} fontWeight={700}
                  fill={p.score.startsWith('+') ? '#10b981' : '#ef4444'}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.1 }}
                >
                  {p.score}
                </motion.text>
              )}
            </motion.g>
          ))}
        </AnimatePresence>

        {/* Extremes */}
        <text x={-R - 4} y={12} textAnchor="end" fontSize={9} fill="var(--c-muted)">Frío</text>
        <text x={R + 4}  y={12} textAnchor="start" fontSize={9} fill="var(--c-muted)">Caliente</text>

        {/* Category title — well above the arc so it never overlaps */}
        <text x={0} y={-76} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--c-text)">Temperatura</text>
      </svg>
    </div>
  );
}

function InfoSlide({ data }) {
  return (
    <div style={{ width: '100%', maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
      {data.items && (
        <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {data.items.map((item, i) => (
            <li key={i} style={{ color: 'var(--c-muted)', fontSize: 12.5, lineHeight: 1.5 }}
              dangerouslySetInnerHTML={{ __html: item }}
            />
          ))}
        </ul>
      )}
      {data.intro && (
        <p style={{ color: 'var(--c-muted)', fontSize: 12.5, lineHeight: 1.5, margin: '0 0 4px' }}
          dangerouslySetInnerHTML={{ __html: data.intro }}
        />
      )}
      {data.modes && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {data.modes.map((m, i) => (
            <div key={i} style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border2)', borderRadius: 8, padding: '7px 10px' }}>
              <span style={{ fontFamily: 'Fredoka One', fontSize: 13, color: 'var(--c-accent2)', marginRight: 6 }}>{m.name}</span>
              <span style={{ color: 'var(--c-muted)', fontSize: 12, lineHeight: 1.4 }}>{m.desc}</span>
            </div>
          ))}
        </div>
      )}
      {data.powers && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {data.powers.map((p, i) => (
            <div key={i} style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border2)', borderRadius: 8, padding: '7px 10px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{p.icon}</span>
              <div>
                <span style={{ fontFamily: 'Fredoka One', fontSize: 13, color: 'var(--c-text)', marginRight: 5 }}>{p.name}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-accent)', background: 'rgba(99,102,241,0.12)', borderRadius: 4, padding: '1px 4px', marginRight: 5 }}>{p.cost}</span>
                <span style={{ color: 'var(--c-muted)', fontSize: 12, lineHeight: 1.4 }}>{p.desc}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TutorialOverlay({ onClose }) {
  const { lang } = useSettings();
  const slides = SLIDES[lang] ?? SLIDES.es;
  const [slide, setSlide] = useState(0);

  const isLast = slide === slides.length - 1;
  const prev = () => setSlide(s => Math.max(0, s - 1));
  const next = () => { if (isLast) onClose(); else setSlide(s => s + 1); };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border2)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: 380, boxShadow: 'var(--shadow-window)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Slide counter bar */}
        <div style={{ display: 'flex', gap: 3, padding: '12px 16px 0' }}>
          {slides.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= slide ? 'var(--c-accent2)' : 'var(--c-border2)', transition: 'background 0.2s' }} />
          ))}
        </div>

        <div style={{ padding: '18px 22px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          {/* Slide text */}
          <AnimatePresence mode="wait">
            <motion.div key={slide}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.18 }}
              style={{ textAlign: 'center', minHeight: 52 }}
            >
              <div style={{ fontFamily: 'Fredoka One', fontSize: 17, color: 'var(--c-text)', marginBottom: 5 }}>
                {slides[slide].title}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--c-muted)', lineHeight: 1.5 }}>
                {slides[slide].desc}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Dial / Info */}
          {slides[slide].type === 'info'
            ? <InfoSlide data={slides[slide]} />
            : <DialSlide slide={slide} />
          }

          {/* Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
            <button
              onClick={prev}
              disabled={slide === 0}
              style={{
                padding: '8px 16px', background: 'var(--c-surface2)',
                border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)',
                cursor: slide === 0 ? 'default' : 'pointer',
                color: 'var(--c-text)', opacity: slide === 0 ? 0.25 : 1,
                fontFamily: 'Nunito, sans-serif', fontSize: 16, lineHeight: 1,
              }}
            >←</button>

            <div style={{ flex: 1, display: 'flex', gap: 6, justifyContent: 'center' }}>
              {slides.map((_, i) => (
                <button key={i} onClick={() => setSlide(i)} style={{
                  width: 7, height: 7, borderRadius: '50%', padding: 0, border: 'none', cursor: 'pointer',
                  background: i === slide ? 'var(--c-accent2)' : 'var(--c-border2)',
                  transition: 'background 0.2s',
                }} />
              ))}
            </div>

            <button
              onClick={next}
              style={{
                padding: '8px 16px',
                background: isLast ? 'var(--c-accent)' : 'var(--c-surface2)',
                border: `1px solid ${isLast ? 'var(--c-accent)' : 'var(--c-border)'}`,
                borderRadius: 'var(--r-sm)',
                cursor: 'pointer',
                color: isLast ? '#fff' : 'var(--c-text)',
                fontFamily: 'Nunito, sans-serif', fontSize: isLast ? 13 : 16,
                fontWeight: isLast ? 700 : 400, lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              {isLast ? (lang === 'en' ? '✓ Got it' : '✓ Listo') : '→'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
