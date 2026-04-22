import { motion } from 'framer-motion';
import Button from '../components/shared/Button';

export default function Splash({ onPlay }) {
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
        <div style={{ fontFamily: 'Fredoka One', fontSize: 64, color: 'var(--c-accent2)', lineHeight: 1 }}>
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
      >
        <Button size="lg" onClick={onPlay}>Jugar</Button>
      </motion.div>
    </div>
  );
}
