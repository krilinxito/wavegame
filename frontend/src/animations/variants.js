export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
};

export const slideUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -20 },
};

export const popIn = {
  initial: { opacity: 0, scale: 0.7 },
  animate: { opacity: 1, scale: 1 },
  exit:    { opacity: 0, scale: 0.7 },
};

export const springTransition = {
  type: 'spring',
  stiffness: 300,
  damping: 24,
};

export const smoothTransition = {
  duration: 0.3,
  ease: 'easeOut',
};
