import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export default function Timer({ seconds = 120, onExpire, paused = false }) {
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    setRemaining(seconds);
    expiredRef.current = false;
  }, [seconds]);

  useEffect(() => {
    if (paused) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(intervalRef.current);
          if (!expiredRef.current) { expiredRef.current = true; onExpire?.(); }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [paused, onExpire]);

  const mins = String(Math.floor(remaining / 60)).padStart(1, '0');
  const secs = String(remaining % 60).padStart(2, '0');
  const pct = remaining / seconds;
  const color = pct > 0.5 ? 'var(--c-green)' : pct > 0.25 ? 'var(--c-yellow)' : 'var(--c-red)';
  const urgent = pct <= 0.25 && remaining > 0;

  return (
    <motion.div
      animate={urgent ? { opacity: [1, 0.6, 1] } : {}}
      transition={{ repeat: Infinity, duration: 0.9 }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        background: 'var(--c-surface2)',
        border: `1px solid ${urgent ? 'var(--c-red)' : 'var(--c-border)'}`,
        borderRadius: 'var(--r-sm)', padding: '4px 12px',
      }}
    >
      <svg width={22} height={22} viewBox="0 0 22 22">
        <circle cx={11} cy={11} r={8} fill="none" stroke="var(--c-border2)" strokeWidth={2.5} />
        <circle
          cx={11} cy={11} r={8}
          fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="butt"
          strokeDasharray={`${2 * Math.PI * 8}`}
          strokeDashoffset={`${2 * Math.PI * 8 * (1 - pct)}`}
          transform="rotate(-90 11 11)"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
        />
      </svg>
      <span style={{ fontFamily: 'Fredoka One', fontSize: 17, color, minWidth: 38, letterSpacing: 1 }}>
        {mins}:{secs}
      </span>
    </motion.div>
  );
}
