import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/shared/Button';
import { useIsMobile } from '../hooks/useIsMobile';
import TutorialOverlay from '../components/shared/TutorialOverlay';
import { useSettings } from '../context/SettingsContext';

export default function Splash({ onPlay }) {
  const isMobile = useIsMobile();
  const { lang } = useSettings();
  const [showTutorial, setShowTutorial] = useState(false);
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 20, position: 'relative', zIndex: 1,
    }}>
      <motion.img
        src="/images/FAVICON_WAVE.png"
        width={100}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ filter: 'drop-shadow(3px 3px 0 rgba(0,0,0,0.18))' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        style={{ textAlign: 'center' }}
      >
        <div style={{ fontFamily: 'Fredoka One', fontSize: isMobile ? 48 : 64, color: 'var(--c-accent2)', lineHeight: 1 }}>
          Wave
        </div>
        <div style={{
          fontFamily: 'Nunito, sans-serif', fontSize: 13,
          color: 'var(--c-muted)', textTransform: 'uppercase',
          letterSpacing: 4, marginTop: 6,
        }}>
          by la plebe
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
      >
        <Button size="lg" onClick={onPlay}>Jugar</Button>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          onClick={() => setShowTutorial(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--c-muted)', fontSize: 13,
            fontFamily: 'Nunito, sans-serif', fontWeight: 700,
            letterSpacing: 0.5,
            textDecoration: 'underline', textDecorationStyle: 'dotted',
            textUnderlineOffset: 3,
            padding: '4px 8px',
          }}
        >
          {lang === 'en' ? 'How to play?' : '¿Cómo jugar?'}
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {showTutorial && <TutorialOverlay onClose={() => setShowTutorial(false)} />}
      </AnimatePresence>
    </div>
  );
}
