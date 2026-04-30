import { createContext, useContext, useState } from 'react';
import { setMusicVolume, setSfxEnabled } from '../utils/sound';

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [musicVolume, setMusicVolumeState] = useState(() =>
    parseInt(localStorage.getItem('wave_music_vol') ?? '35')
  );
  const [sfxOn, setSfxOnState] = useState(() =>
    localStorage.getItem('wave_sfx_on') !== 'false'
  );
  const [lang, setLangState] = useState(() =>
    localStorage.getItem('wave_lang') ?? 'es'
  );

  const updateMusicVolume = (v) => {
    setMusicVolumeState(v);
    localStorage.setItem('wave_music_vol', v);
    setMusicVolume(v);
  };

  const updateSfxOn = (on) => {
    setSfxOnState(on);
    localStorage.setItem('wave_sfx_on', on);
    setSfxEnabled(on);
  };

  const updateLang = (l) => {
    setLangState(l);
    localStorage.setItem('wave_lang', l);
  };

  return (
    <SettingsContext.Provider value={{
      musicVolume, sfxOn, lang,
      setMusicVolume: updateMusicVolume,
      setSfxOn: updateSfxOn,
      setLang: updateLang,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
