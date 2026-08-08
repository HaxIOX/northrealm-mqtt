/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

const lightTheme = {
  bg: 'bg-[#F7F7F7]',
  bgSecondary: 'bg-white',
  bgTertiary: 'bg-slate-50',
  bgHover: 'hover:bg-slate-50',
  bgInput: 'bg-white',
  border: 'border-slate-200',
  borderLight: 'border-slate-100',
  text: 'text-slate-900',
  textSecondary: 'text-slate-600',
  textMuted: 'text-slate-400',
  shadow: 'shadow-sm',
  shadowLg: 'shadow-lg shadow-slate-200/50',
  card: 'bg-white border-slate-100',
  cardHover: 'hover:border-slate-200 hover:shadow-md',
  accent: 'neutral',
  accentBg: 'bg-black',
  accentText: 'text-black',
  accentLight: 'bg-neutral-100',
};

const darkTheme = {
  bg: 'bg-black',
  bgSecondary: 'bg-neutral-950',
  bgTertiary: 'bg-neutral-900',
  bgHover: 'hover:bg-neutral-800',
  bgInput: 'bg-neutral-900',
  border: 'border-neutral-800',
  borderLight: 'border-neutral-900',
  text: 'text-white',
  textSecondary: 'text-neutral-300',
  textMuted: 'text-neutral-500',
  shadow: 'shadow-none',
  shadowLg: 'shadow-lg shadow-black/20',
  card: 'bg-neutral-950 border-neutral-800',
  cardHover: 'hover:border-neutral-600',
  accent: 'neutral',
  accentBg: 'bg-white',
  accentText: 'text-white',
  accentLight: 'bg-neutral-900',
};

function getSystemTheme() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('mqtt_theme');
    return saved === 'light' || saved === 'dark' ? saved : getSystemTheme();
  });

  useEffect(() => {
    if (localStorage.getItem('mqtt_theme')) return undefined;
    const media = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!media) return undefined;
    const handleChange = () => setTheme(media.matches ? 'light' : 'dark');
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('mqtt_theme', newTheme);
  };

  const t = theme === 'light' ? lightTheme : darkTheme;

  return (
    <ThemeContext.Provider value={{ theme, t, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
