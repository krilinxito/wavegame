import { useSettings } from '../context/SettingsContext';
import { LANG } from '../lang';

export function useLang() {
  const { lang } = useSettings();
  return LANG[lang] ?? LANG.es;
}
