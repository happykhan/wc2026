import { useState, useEffect, useCallback } from 'react';
import { THEMES } from '../data/teamColors';

export type DarkModePreference = 'system' | 'light' | 'dark';

/**
 * Returns '#ffffff' or '#000000' depending on which gives better contrast
 * against the given hex colour.
 */
function contrastFg(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // Relative luminance (simplified sRGB formula)
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 160 ? '#000000' : '#ffffff';
}

const DARK_MODE_KEY = 'wc2026_darkMode';

function loadDarkMode(): DarkModePreference {
  try {
    const stored = localStorage.getItem(DARK_MODE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // ignore
  }
  return 'system';
}

export function useTheme(themeKey: string | null) {
  const [darkMode, setDarkModeState] = useState<DarkModePreference>(loadDarkMode);

  const applyDark = useCallback((pref: DarkModePreference) => {
    if (pref === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (pref === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // Follow the OS preference
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      document.documentElement.classList.toggle('dark', mq.matches);
    }
  }, []);

  // Apply team accent colours whenever the chosen team changes
  useEffect(() => {
    const theme = themeKey ? (THEMES[themeKey] ?? THEMES.default) : THEMES.default;
    const root = document.documentElement;
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--accent-primary', theme.primary);
    root.style.setProperty('--accent-secondary', theme.away ?? theme.secondary);
    // Set --accent-fg to white or black depending on luminance of the accent colour
    root.style.setProperty('--accent-fg', contrastFg(theme.accent));
  }, [themeKey]);

  // Apply dark-mode class whenever the preference changes; also listen for
  // OS-level changes when the preference is 'system'.
  useEffect(() => {
    applyDark(darkMode);

    if (darkMode !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyDark('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [darkMode, applyDark]);

  // Cycle: system → dark → light → system
  const toggleDarkMode = useCallback(() => {
    setDarkModeState((prev) => {
      const next: DarkModePreference =
        prev === 'system' ? 'dark' : prev === 'dark' ? 'light' : 'system';
      try {
        localStorage.setItem(DARK_MODE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { darkMode, toggleDarkMode };
}
