import { useState } from 'react';

export function useLocalPlayer() {
  const [playerId, setPlayerIdState] = useState(() => localStorage.getItem('wave_player_id') || null);
  const [displayName, setDisplayNameState] = useState(() => localStorage.getItem('wave_display_name') || '');
  const [photoPath, setPhotoPathState] = useState(() => localStorage.getItem('wave_photo_path') || null);

  const savePlayer = (id, name, photo) => {
    localStorage.setItem('wave_player_id', id);
    localStorage.setItem('wave_display_name', name);
    if (photo) localStorage.setItem('wave_photo_path', photo);
    setPlayerIdState(id);
    setDisplayNameState(name);
    setPhotoPathState(photo);
  };

  const clearPlayer = () => {
    localStorage.removeItem('wave_player_id');
    localStorage.removeItem('wave_display_name');
    localStorage.removeItem('wave_photo_path');
    setPlayerIdState(null);
    setDisplayNameState('');
    setPhotoPathState(null);
  };

  return { playerId, displayName, photoPath, savePlayer, clearPlayer };
}
