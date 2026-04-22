// Single persistent audio element — prevents simultaneous duplicate tracks
let musicAudio = null;
let currentMusicName = null;

function getMusicAudio() {
  if (!musicAudio) {
    musicAudio = new Audio();
    musicAudio.volume = 0.35;
  }
  return musicAudio;
}

// If autoplay is blocked, retry on first user interaction
function playWhenAllowed(audio, name) {
  const retry = () => {
    if (currentMusicName === name) audio.play().catch(() => {});
    window.removeEventListener('click', retry);
    window.removeEventListener('keydown', retry);
  };
  window.addEventListener('click', retry);
  window.addEventListener('keydown', retry);
}

export function playSfx(name) {
  const a = new Audio(`/sounds/${name}.mp3`);
  a.volume = 0.65;
  a.play().catch(() => {});
}

export function playMusic(name, { loop = true } = {}) {
  if (currentMusicName === name) return;
  const audio = getMusicAudio();
  audio.pause();
  audio.src = `/sounds/${name}.mp3`;
  audio.loop = loop;
  currentMusicName = name;
  audio.play().catch(() => playWhenAllowed(audio, name));
}

export function stopMusic() {
  if (musicAudio) {
    musicAudio.pause();
    musicAudio.src = '';
  }
  currentMusicName = null;
}
