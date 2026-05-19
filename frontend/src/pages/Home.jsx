import { useState, useRef, useEffect } from 'react';
import { BACKEND } from '../config';
import { useIsMobile } from '../hooks/useIsMobile';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/shared/Button';
import { useSettings } from '../context/SettingsContext';
import { useLocalPlayer } from '../hooks/useLocalPlayer';
import TutorialOverlay from '../components/shared/TutorialOverlay';

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
  const { displayName: savedName, playerId: savedPlayerId } = useLocalPlayer();

  const [name, setName]         = useState(savedName || '');
  const [roomCode, setRoomCode] = useState('');
  const [tab, setTab]           = useState('create');
  const [photo, setPhoto]       = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
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
    if (!photo) return null;
    const fd = new FormData();
    fd.append('photo', photo);
    const res = await fetch(`${BACKEND}/api/upload/photo`, { method: 'POST', body: fd });
    if (!res.ok) return null;
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
        onClick={() => setShowTutorial(true)}
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

      <AnimatePresence>
        {showTutorial && <TutorialOverlay onClose={() => setShowTutorial(false)} />}
      </AnimatePresence>
    </div>
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
