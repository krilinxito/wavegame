import { useState, useRef, useEffect } from 'react';
import { BACKEND } from '../config';
import { useIsMobile } from '../hooks/useIsMobile';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/shared/Button';
import { useSettings } from '../context/SettingsContext';
import { useLocalPlayer } from '../hooks/useLocalPlayer';

const STRINGS = {
  es: {
    create: 'Crear sala', join: 'Unirse',
    photo: 'Foto de perfil', optional: 'Opcional · max 2MB',
    namePlaceholder: 'Tu nombre', codePlaceholder: 'Código de sala',
    loading: 'Cargando...', createBtn: 'Crear sala', joinBtn: 'Entrar',
    nameRequired: 'Ingresá tu nombre', codeRequired: 'Ingresá el código de sala',
    notFound: 'Sala no encontrada', createError: 'Error al crear la sala', joinError: 'Error al conectarse',
    tagline: 'El wavelength de la plebe',
    howTo: '¿Cómo jugar?',
    howToClose: 'Entendido',
  },
  en: {
    create: 'Create room', join: 'Join',
    photo: 'Profile photo', optional: 'Optional · max 2MB',
    namePlaceholder: 'Your name', codePlaceholder: 'Room code',
    loading: 'Loading...', createBtn: 'Create room', joinBtn: 'Enter',
    nameRequired: 'Enter your name', codeRequired: 'Enter the room code',
    notFound: 'Room not found', createError: 'Error creating room', joinError: 'Error connecting',
    tagline: 'The wavelength of la plebe',
    howTo: 'How to play?',
    howToClose: 'Got it',
  },
};

export default function Home({ onJoin }) {
  const isMobile = useIsMobile();
  const { lang } = useSettings();
  const s = STRINGS[lang] ?? STRINGS.es;
  const { displayName: savedName, photoPath: savedPhoto, playerId: savedPlayerId } = useLocalPlayer();

  const [name, setName]         = useState(savedName || '');
  const [roomCode, setRoomCode] = useState('');
  const [tab, setTab]           = useState('create');
  const [photo, setPhoto]       = useState(null);
  const [photoPreview, setPhotoPreview] = useState(savedPhoto ? `${BACKEND}${savedPhoto}` : null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showHowTo, setShowHowTo] = useState(false);
  const [inviteMode, setInviteMode] = useState(false);
  const fileRef = useRef();

  // Pre-fill room code from URL (e.g. wavebyplebe.com/ABC1234)
  useEffect(() => {
    const code = window.location.pathname.slice(1).toUpperCase();
    if (/^[A-Z0-9]{4,8}$/.test(code)) {
      setRoomCode(code);
      setTab('join');
      setInviteMode(true);
    }
  }, []);

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const uploadPhoto = async () => {
    if (!photo) return savedPhoto || null; // reuse saved path if no new photo selected
    const fd = new FormData();
    fd.append('photo', photo);
    const res = await fetch(`${BACKEND}/api/upload/photo`, { method: 'POST', body: fd });
    if (!res.ok) return savedPhoto || null;
    return (await res.json()).path;
  };

  const handleCreate = async () => {
    if (!name.trim()) return setError(s.nameRequired);
    setLoading(true); setError('');
    try {
      const res = await fetch(`${BACKEND}/api/games`, { method: 'POST' });
      const game = await res.json();
      const photoPath = await uploadPhoto();
      onJoin(game.room_code, game.id, name.trim(), photoPath, savedPlayerId);
    } catch { setError(s.createError); }
    finally { setLoading(false); }
  };

  const handleJoin = async () => {
    if (!name.trim()) return setError(s.nameRequired);
    if (!roomCode.trim()) return setError(s.codeRequired);
    setLoading(true); setError('');
    try {
      const res = await fetch(`${BACKEND}/api/games/${roomCode.trim().toUpperCase()}`);
      if (!res.ok) return setError(s.notFound);
      const game = await res.json();
      const photoPath = await uploadPhoto();
      onJoin(game.room_code, game.id, name.trim(), photoPath, savedPlayerId);
    } catch { setError(s.joinError); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ marginBottom: isMobile ? 28 : 52, textAlign: 'center' }}
      >
        <div style={{ fontFamily: 'Fredoka One', fontSize: isMobile ? 64 : 92, color: 'var(--c-accent2)', letterSpacing: 2, lineHeight: 1 }}>
          Wave
        </div>
        <div style={{ fontSize: 13, color: 'var(--c-muted)', letterSpacing: 3, marginTop: 4, textTransform: 'uppercase' }}>
          by la plebe
        </div>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        style={{
          background: 'var(--c-surface)',
          borderRadius: 'var(--r-lg)',
          border: '1px solid var(--c-border2)',
          padding: isMobile ? '20px 16px' : '32px 44px',
          width: '100%', maxWidth: 480,
          boxShadow: 'var(--shadow-window)',
        }}
      >
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, border: '1px solid var(--c-border2)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
          {['create', 'join'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '8px 0', fontWeight: 700, fontSize: 14,
                fontFamily: 'Nunito, sans-serif',
                background: tab === t ? 'var(--c-accent)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--c-muted)',
                cursor: 'pointer',
                letterSpacing: 0.3,
              }}
            >
              {t === 'create' ? s.create : s.join}
            </button>
          ))}
        </div>

        {/* Photo picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              width: 56, height: 56,
              borderRadius: 'var(--r-sm)',
              border: '2px dashed var(--c-border2)',
              cursor: 'pointer', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--c-surface2)',
              fontSize: 22, flexShrink: 0,
            }}
          >
            {photoPreview
              ? <img src={photoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : '📷'
            }
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{s.photo}</div>
            <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>{s.optional}</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
        </div>

        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={s.namePlaceholder}
          maxLength={50}
          style={inputStyle}
        />

        {tab === 'join' && (
          <input
            value={roomCode}
            onChange={e => setRoomCode(e.target.value.toUpperCase())}
            placeholder={s.codePlaceholder}
            maxLength={8}
            style={{ ...inputStyle, fontFamily: 'Fredoka One', letterSpacing: 4, marginTop: 8 }}
          />
        )}

        {error && <div style={{ color: 'var(--c-red)', fontSize: 13, margin: '10px 0 0', fontWeight: 600 }}>{error}</div>}

        <Button
          onClick={tab === 'create' ? handleCreate : handleJoin}
          disabled={loading}
          style={{ width: '100%', marginTop: 16 }}
          size="lg"
        >
          {loading ? s.loading : tab === 'create' ? s.createBtn : s.joinBtn}
        </Button>
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        onClick={() => setShowHowTo(true)}
        style={{
          marginTop: 16,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--c-muted)', fontSize: 13,
          fontFamily: 'Nunito, sans-serif', fontWeight: 700,
          letterSpacing: 0.5,
          textDecoration: 'underline', textDecorationStyle: 'dotted',
          textUnderlineOffset: 3,
          padding: '4px 8px',
        }}
        whileHover={{ color: 'var(--c-text)' }}
      >
        {s.howTo}
      </motion.button>

      <div style={{ marginTop: 8, color: 'var(--c-muted)', fontSize: 12 }}>
        {s.tagline}
      </div>

      <HowToPlay open={showHowTo} onClose={() => setShowHowTo(false)} lang={lang} closeLabel={s.howToClose} />
    </div>
  );
}

const CONTENT = {
  es: {
    title: '¿Cómo jugar?',
    sections: [
      {
        icon: '🧠', heading: 'El juego',
        items: [
          'Cada ronda, un jugador es el <b>Psychic</b> — solo él ve la posición secreta en el espectro.',
          'El Psychic da una pista para que el resto adivine dónde está el objetivo.',
          'El espectro tiene dos extremos opuestos (ej: Frío ←——→ Caliente). La posición objetivo está en algún punto entre medio.',
          'Bullseye 🎯 = 4 pts · Cerca 🔥 = 3 pts · Casi ✓ = 2 pts',
          'El Psychic gana +1 por cada jugador que acertó. Si nadie acierta, pierde -2.',
        ],
      },
      {
        icon: '🃏', heading: 'Las categorías',
        items: [
          'Cada categoría tiene un <b>concepto central</b> y <b>dos extremos opuestos</b> en el espectro.',
          'Ejemplo: concepto <b>"Temperatura"</b> → extremos <b>Frío</b> y <b>Caliente</b>.',
          'Las mejores categorías son <b>subjetivas y debatibles</b> — sin respuesta obvia.',
          'Evitá extremos que sean hechos objetivos (ej: "Países grandes" → "Pequeño / Grande" tiene respuesta única).',
          'Tips: animales, películas, canciones, conceptos abstractos, lugares, personas públicas... ¡la creatividad manda!',
        ],
      },
      {
        icon: '🎮', heading: 'Modos de juego',
        modes: [
          { name: 'Normal', desc: 'El psychic rota entre todos los jugadores cada ronda. Los poderes están activados. Gana el primero en llegar al puntaje objetivo (o el que más tenga al terminar las rondas).' },
          { name: 'Teams', desc: 'Se juega en parejas. Cada pareja tiene su propio espectro y adivinan al mismo tiempo. Sin poderes. Gana la pareja con más puntos.' },
          { name: 'BASTA ⚡', desc: 'El primero en confirmar su adivinanza es el único que puede ganar puntos esa ronda. Los demás ganan +1 si el primero falla.' },
        ],
      },
      {
        icon: '⚡', heading: 'Poderes',
        intro: 'En modo Normal, cada ronda tenés 75% de chance de recibir una oferta de poder. Podés comprarlo con tus puntos (máx. 3 activos). Si hacés Bullseye, el próximo turno recibís uno <b>gratis</b>.',
        powers: [
          { icon: '🔮', name: 'Cuartiles', cost: '3 pts', desc: 'Revela en qué cuartil del espectro está el objetivo. Si adivinás en ese cuartil, obtenés puntuación especial.' },
          { icon: '☠️', name: 'Veneno',    cost: '3 pts', desc: 'El jugador objetivo pierde 3 puntos al instante. Cuidado: si vos fallás, tu penalización se duplica.' },
          { icon: '🛡️', name: 'Escudo',   cost: '2 pts', desc: 'Si fallás esta ronda, no recibís penalización. Gratis si fallás.' },
          { icon: '🚫', name: 'Bloqueo',  cost: '3 pts', desc: 'El jugador objetivo no puede adivinar esta ronda. Si vos fallás, tu penalización es x1.5.' },
          { icon: '🔄', name: 'Switch',   cost: '3 pts', desc: 'Intercambia tu posición de adivinanza con la de otro jugador justo antes de revelar.' },
        ],
      },
    ],
  },
  en: {
    title: 'How to play?',
    sections: [
      {
        icon: '🧠', heading: 'The game',
        items: [
          'Each round, one player is the <b>Psychic</b> — only they see the secret position on the spectrum.',
          'The Psychic gives a clue so everyone else can guess where the target is.',
          'The spectrum has two opposite extremes (e.g. Cold ←——→ Hot). The target is somewhere in between.',
          'Bullseye 🎯 = 4 pts · Close 🔥 = 3 pts · Near ✓ = 2 pts',
          'The Psychic earns +1 for each player who scored. If nobody scores, they lose -2.',
        ],
      },
      {
        icon: '🃏', heading: 'Categories',
        items: [
          'Each category has a <b>central concept</b> and <b>two opposite extremes</b> on the spectrum.',
          'Example: concept <b>"Temperature"</b> → extremes <b>Cold</b> and <b>Hot</b>.',
          'The best categories are <b>subjective and debatable</b> — no obvious answer.',
          'Avoid extremes that are objective facts (e.g. "Big countries → Small / Big" has one answer).',
          'Tips: animals, movies, songs, abstract concepts, places, public figures... creativity is key!',
        ],
      },
      {
        icon: '🎮', heading: 'Game modes',
        modes: [
          { name: 'Normal', desc: 'The psychic rotates among all players each round. Powers are active. First to reach the score goal wins (or whoever has the most when rounds end).' },
          { name: 'Teams', desc: 'Play in pairs. Each pair gets their own spectrum and guesses simultaneously. No powers. The pair with the most points wins.' },
          { name: 'BASTA ⚡', desc: 'The first player to confirm their guess is the only one who can score that round. Others earn +1 if the first player misses.' },
        ],
      },
      {
        icon: '⚡', heading: 'Powers',
        intro: 'In Normal mode, each round you have a 75% chance of receiving a power offer. You can buy it with your points (max 3 active). If you get a Bullseye, your next turn you receive one <b>for free</b>.',
        powers: [
          { icon: '🔮', name: 'Quartiles', cost: '3 pts', desc: 'Reveals which quartile of the spectrum the target is in. If you guess in that quartile, you get a special score.' },
          { icon: '☠️', name: 'Poison',    cost: '3 pts', desc: 'The target player loses 3 points instantly. Warning: if you miss, your penalty doubles.' },
          { icon: '🛡️', name: 'Shield',   cost: '2 pts', desc: "If you miss this round, you don't receive a penalty." },
          { icon: '🚫', name: 'Block',     cost: '3 pts', desc: "The target player can't guess this round. If you miss, your penalty is x1.5." },
          { icon: '🔄', name: 'Switch',    cost: '3 pts', desc: 'Swaps your guess position with another player\'s just before reveal.' },
        ],
      },
    ],
  },
};

function HowToPlay({ open, onClose, lang, closeLabel }) {
  const isMobile = useIsMobile();
  const c = CONTENT[lang] ?? CONTENT.es;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(10,8,20,0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--c-surface)',
              borderRadius: 'var(--r-lg)',
              border: '1px solid var(--c-border2)',
              boxShadow: 'var(--shadow-window)',
              width: '100%', maxWidth: isMobile ? '95vw' : 560,
              maxHeight: '88vh',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px 16px',
              borderBottom: '1px solid var(--c-border2)',
              flexShrink: 0,
            }}>
              <span style={{ fontFamily: 'Fredoka One', fontSize: 22, color: 'var(--c-accent2)' }}>
                {c.title}
              </span>
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--c-muted)', fontSize: 20, lineHeight: 1,
                  padding: '2px 6px', borderRadius: 6,
                }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable content */}
            <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
              {c.sections.map((sec, i) => (
                <div key={i}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                  }}>
                    <span style={{ fontSize: 18 }}>{sec.icon}</span>
                    <span style={{ fontFamily: 'Fredoka One', fontSize: 17, color: 'var(--c-text)' }}>
                      {sec.heading}
                    </span>
                  </div>

                  {/* Bullet list */}
                  {sec.items && (
                    <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {sec.items.map((item, j) => (
                        <li key={j} style={{ color: 'var(--c-muted)', fontSize: 13.5, lineHeight: 1.55 }}
                          dangerouslySetInnerHTML={{ __html: item }}
                        />
                      ))}
                    </ul>
                  )}

                  {/* Modes */}
                  {sec.modes && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {sec.modes.map((m, j) => (
                        <div key={j} style={{
                          background: 'var(--c-surface2)',
                          border: '1px solid var(--c-border2)',
                          borderRadius: 10, padding: '10px 14px',
                        }}>
                          <span style={{ fontFamily: 'Fredoka One', fontSize: 14, color: 'var(--c-accent2)', marginRight: 8 }}>
                            {m.name}
                          </span>
                          <span style={{ color: 'var(--c-muted)', fontSize: 13, lineHeight: 1.5 }}>{m.desc}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Powers */}
                  {sec.powers && (
                    <>
                      {sec.intro && (
                        <p style={{ color: 'var(--c-muted)', fontSize: 13.5, lineHeight: 1.55, marginBottom: 12 }}
                          dangerouslySetInnerHTML={{ __html: sec.intro }}
                        />
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {sec.powers.map((p, j) => (
                          <div key={j} style={{
                            background: 'var(--c-surface2)',
                            border: '1px solid var(--c-border2)',
                            borderRadius: 10, padding: '10px 14px',
                            display: 'flex', gap: 10, alignItems: 'flex-start',
                          }}>
                            <span style={{ fontSize: 18, flexShrink: 0 }}>{p.icon}</span>
                            <div>
                              <span style={{ fontFamily: 'Fredoka One', fontSize: 14, color: 'var(--c-text)', marginRight: 6 }}>
                                {p.name}
                              </span>
                              <span style={{
                                fontSize: 11, fontWeight: 700, color: 'var(--c-accent)',
                                background: 'rgba(var(--c-accent-rgb,99,102,241),0.12)',
                                borderRadius: 4, padding: '1px 5px', marginRight: 6,
                              }}>
                                {p.cost}
                              </span>
                              <span style={{ color: 'var(--c-muted)', fontSize: 13, lineHeight: 1.5 }}>{p.desc}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--c-border2)',
              flexShrink: 0,
            }}>
              <Button onClick={onClose} style={{ width: '100%' }}>
                {closeLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const inputStyle = {
  width: '100%',
  background: 'var(--c-surface2)',
  border: '1px solid var(--c-border2)',
  borderRadius: 'var(--r-sm)',
  padding: '10px 14px',
  color: 'var(--c-text)',
  fontSize: 15,
  outline: 'none',
  display: 'block',
};
