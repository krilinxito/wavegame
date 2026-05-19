import { useState } from 'react';

export function useLocalPlayer() {
  const [playerId, setPlayerIdState] = useState(() => localStorage.getItem('wave_player_id') || null);
  const [displayName, setDisplayNameState] = useState(() => localStorage.getItem('wave_display_name') || '');
  const savePlayer = (id, name) => {
    localStorage.setItem('wave_player_id', id);
    localStorage.setItem('wave_display_name', name);
    setPlayerIdState(id);
    setDisplayNameState(name);
  };

  const clearPlayer = () => {
    localStorage.removeItem('wave_player_id');
    localStorage.removeItem('wave_display_name');
    setPlayerIdState(null);
    setDisplayNameState('');
  };

  return { playerId, displayName, savePlayer, clearPlayer };
}
