import { motion, AnimatePresence } from 'framer-motion';

export default function Modal({ open, onClose, children, title }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(30,15,5,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--c-surface)',
              borderRadius: 'var(--r-lg)',
              border: '1px solid var(--c-border2)',
              padding: '24px 28px',
              maxWidth: 460, width: '100%',
              boxShadow: 'var(--shadow-window)',
            }}
          >
            {title && (
              <h2 style={{ fontFamily: 'Fredoka One', fontSize: 20, marginBottom: 14, color: 'var(--c-text)' }}>
                {title}
              </h2>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
