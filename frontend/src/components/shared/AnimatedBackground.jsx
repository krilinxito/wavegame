import { motion } from 'framer-motion';

const BLOBS = [
  { left: '8%',  top: '12%', size: 380, color: '#b83820', opacity: 0.32, yDur: 9,  xDur: 23, sDur: 17, delay: 0,   xRange: 28,  sRange: 0.08 },
  { left: '70%', top: '8%',  size: 300, color: '#7a4200', opacity: 0.30, yDur: 11, xDur: 29, sDur: 21, delay: 2,   xRange: -22, sRange: 0.07 },
  { left: '80%', top: '65%', size: 420, color: '#b83820', opacity: 0.28, yDur: 13, xDur: 31, sDur: 19, delay: 4,   xRange: 18,  sRange: 0.09 },
  { left: '15%', top: '70%', size: 260, color: '#c84a00', opacity: 0.34, yDur: 8,  xDur: 25, sDur: 15, delay: 1.5, xRange: -30, sRange: 0.06 },
  { left: '48%', top: '40%', size: 200, color: '#7a4200', opacity: 0.26, yDur: 10, xDur: 27, sDur: 22, delay: 3.5, xRange: 24,  sRange: 0.10 },
];

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`;

export default function AnimatedBackground() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {BLOBS.map((b, i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, 30, 0],
            x: [0, b.xRange, b.xRange * -0.6, b.xRange * 0.3, 0],
            scale: [1, 1 + b.sRange, 1 - b.sRange * 0.6, 1 + b.sRange * 0.3, 1],
          }}
          transition={{
            y:     { duration: b.yDur, delay: b.delay,       repeat: Infinity, ease: 'easeInOut' },
            x:     { duration: b.xDur, delay: b.delay + 0.5, repeat: Infinity, ease: 'easeInOut' },
            scale: { duration: b.sDur, delay: b.delay + 1,   repeat: Infinity, ease: 'easeInOut' },
          }}
          style={{
            position: 'absolute',
            left: b.left,
            top: b.top,
            width: b.size,
            height: b.size,
            borderRadius: '50%',
            background: b.color,
            opacity: b.opacity,
            filter: 'blur(44px)',
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
        opacity: 0.46,
      }} />
    </div>
  );
}
