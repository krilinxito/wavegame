import { motion } from 'framer-motion';

const BLOBS = [
  { left: '8%',  top: '12%', size: 380, color: '#b83820', opacity: 0.09, duration: 9,  delay: 0   },
  { left: '70%', top: '8%',  size: 300, color: '#7a4200', opacity: 0.10, duration: 11, delay: 2   },
  { left: '80%', top: '65%', size: 420, color: '#b83820', opacity: 0.08, duration: 13, delay: 4   },
  { left: '15%', top: '70%', size: 260, color: '#c84a00', opacity: 0.11, duration: 8,  delay: 1.5 },
  { left: '48%', top: '40%', size: 200, color: '#7a4200', opacity: 0.07, duration: 10, delay: 3.5 },
];

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`;

export default function AnimatedBackground() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {BLOBS.map((b, i) => (
        <motion.div
          key={i}
          animate={{ y: [0, 30, 0] }}
          transition={{ duration: b.duration, delay: b.delay, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            left: b.left,
            top: b.top,
            width: b.size,
            height: b.size,
            borderRadius: '50%',
            background: b.color,
            opacity: b.opacity,
            filter: 'blur(70px)',
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}

      {/* Grain overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: GRAIN_SVG,
        backgroundRepeat: 'repeat',
        backgroundSize: '200px 200px',
        opacity: 0.18,
      }} />
    </div>
  );
}
