import { motion } from 'framer-motion';
import { playSfx } from '../../utils/sound';

const VARIANTS = {
  primary:   {
    background: 'var(--c-accent)',
    color: '#fff',
    border: '1px solid rgba(0,0,0,0.35)',
    boxShadow: 'var(--shadow-sm), var(--bevel-up)',
  },
  secondary: {
    background: 'var(--c-surface2)',
    color: 'var(--c-text)',
    border: '1px solid var(--c-border2)',
    boxShadow: 'var(--shadow-sm), var(--bevel-up)',
  },
  danger:    {
    background: 'var(--c-red)',
    color: '#fff',
    border: '1px solid rgba(0,0,0,0.35)',
    boxShadow: 'var(--shadow-sm), var(--bevel-up)',
  },
  success:   {
    background: 'var(--c-green)',
    color: '#fff',
    border: '1px solid rgba(0,0,0,0.35)',
    boxShadow: 'var(--shadow-sm), var(--bevel-up)',
  },
  ghost:     {
    background: 'transparent',
    color: 'var(--c-muted)',
    border: '1px solid var(--c-border2)',
    boxShadow: 'none',
  },
};

const SIZES = {
  sm: { padding: '4px 11px', fontSize: 13 },
  md: { padding: '8px 17px', fontSize: 15 },
  lg: { padding: '11px 26px', fontSize: 17 },
};

export default function Button({ children, onClick, variant = 'primary', disabled, style = {}, size = 'md' }) {
  const handleClick = disabled ? undefined : (e) => { playSfx('sfx_click'); onClick?.(e); };
  return (
    <motion.button
      onClick={handleClick}
      disabled={disabled}
      whileHover={disabled ? {} : { opacity: 0.88, y: -1 }}
      whileTap={disabled ? {} : {
        scale: 0.98,
        boxShadow: 'var(--bevel-down)',
        y: 1,
      }}
      style={{
        borderRadius: 'var(--r-sm)',
        fontWeight: 700,
        fontFamily: 'Nunito, sans-serif',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        letterSpacing: 0.3,
        ...VARIANTS[variant],
        ...SIZES[size],
        ...style,
      }}
    >
      {children}
    </motion.button>
  );
}
