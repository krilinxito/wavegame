// Single persistent audio element — prevents simultaneous duplicate tracks
let musicAudio = null;
let currentMusicName = null;
let pendingMusicVolume = parseInt(localStorage.getItem('wave_music_vol') ?? '35') / 100;
let sfxEnabled = localStorage.getItem('wave_sfx_on') !== 'false';

function getMusicAudio() {
  if (!musicAudio) {
    musicAudio = new Audio();
    musicAudio.volume = pendingMusicVolume;
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

export function setMusicVolume(vol) {
  pendingMusicVolume = vol / 100;
  if (musicAudio) musicAudio.volume = vol / 100;
}

export function setSfxEnabled(on) {
  sfxEnabled = on;
}

export function playSfx(name) {
  if (!sfxEnabled) return;
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
