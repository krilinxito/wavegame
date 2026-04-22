import { useState } from 'react';
import { motion } from 'framer-motion';
import { playSfx } from '../../utils/sound';

export default function RoomCode({ code }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    playSfx('sfx_click_alt');
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      onClick={copy}
      whileHover={{ opacity: 0.8 }}
      whileTap={{ scale: 0.97 }}
      style={{
        cursor: 'pointer',
        background: 'var(--c-surface2)',
        border: '1px solid var(--c-border2)',
        borderRadius: 'var(--r-md)',
        padding: '8px 16px',
        display: 'inline-flex', alignItems: 'center', gap: 12,
      }}
    >
      <span style={{ fontFamily: 'Fredoka One', fontSize: 24, letterSpacing: 4, color: 'var(--c-accent2)' }}>
        {code}
      </span>
      <span style={{ fontSize: 11, color: 'var(--c-muted)' }}>
        {copied ? 'copiado' : 'copiar'}
      </span>
    </motion.div>
  );
}
