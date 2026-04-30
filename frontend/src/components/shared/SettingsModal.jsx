import Modal from './Modal';
import { useSettings } from '../../context/SettingsContext';

const S = {
  es: {
    title: 'Opciones',
    music: 'Música',
    sfx: 'Efectos de sonido',
    sfxOn: 'Sí',
    sfxOff: 'No',
    language: 'Idioma',
  },
  en: {
    title: 'Settings',
    music: 'Music',
    sfx: 'Sound effects',
    sfxOn: 'On',
    sfxOff: 'Off',
    language: 'Language',
  },
};

export default function SettingsModal({ open, onClose }) {
  const { musicVolume, sfxOn, lang, setMusicVolume, setSfxOn, setLang } = useSettings();
  const s = S[lang] ?? S.es;

  return (
    <Modal open={open} onClose={onClose} title={s.title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Music volume */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--c-text)' }}>{s.music}</span>
            <span style={{ color: 'var(--c-muted)', fontSize: 13 }}>{musicVolume}%</span>
          </div>
          <input
            type="range" min="0" max="100" value={musicVolume}
            onChange={e => setMusicVolume(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--c-accent)', cursor: 'pointer' }}
          />
        </div>

        {/* SFX */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--c-text)', marginBottom: 10 }}>{s.sfx}</div>
          <SegmentedControl
            value={sfxOn}
            onChange={setSfxOn}
            options={[
              { label: s.sfxOn, value: true },
              { label: s.sfxOff, value: false },
            ]}
          />
        </div>

        {/* Language */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--c-text)', marginBottom: 10 }}>{s.language}</div>
          <SegmentedControl
            value={lang}
            onChange={setLang}
            options={[
              { label: 'Español', value: 'es' },
              { label: 'English', value: 'en' },
            ]}
          />
        </div>

      </div>
    </Modal>
  );
}

function SegmentedControl({ value, onChange, options }) {
  return (
    <div style={{
      display: 'flex',
      border: '1px solid var(--c-border2)',
      borderRadius: 'var(--r-sm)',
      overflow: 'hidden',
    }}>
      {options.map(opt => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1, padding: '8px 0', fontWeight: 700, fontSize: 14,
            fontFamily: 'Nunito, sans-serif',
            background: value === opt.value ? 'var(--c-accent)' : 'transparent',
            color: value === opt.value ? '#fff' : 'var(--c-muted)',
            cursor: 'pointer', border: 'none',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
