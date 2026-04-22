let currentMusic = null;
let currentMusicName = null;

export function playSfx(name) {
  const a = new Audio(`/sounds/${name}.mp3`);
  a.volume = 0.65;
  a.play().catch(() => {});
}

export function playMusic(name) {
  if (currentMusicName === name) return;
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
  }
  currentMusicName = name;
  currentMusic = new Audio(`/sounds/${name}.mp3`);
  currentMusic.loop = true;
  currentMusic.volume = 0.35;
  currentMusic.play().catch(() => {});
}

export function stopMusic() {
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
    currentMusic = null;
  }
  currentMusicName = null;
}
