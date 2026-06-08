import { useEffect } from 'react';
import { THEMES } from '../data/teamColors';

export function useTheme(themeKey: string | null) {
  useEffect(() => {
    const theme = themeKey ? (THEMES[themeKey] ?? THEMES.default) : THEMES.default;
    const root = document.documentElement;
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--accent-primary', theme.primary);
    root.style.setProperty('--accent-secondary', theme.secondary);
  }, [themeKey]);

  // Dark mode
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.classList.toggle('dark', mq.matches);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
}
