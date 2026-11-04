/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { detectRuntime } from '../mqtt/runtime.js';

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

// 桌面端（宽屏且非原生 App）配色：蓝色强调色，沿用 v0.1.15 Windows 包的外观。手机端继续用上面的单色主题。
const desktopLightTheme = {
  ...lightTheme,
  bg: 'bg-[#F9FAFB]',
  bgSecondary: 'bg-white/60',
  bgTertiary: 'bg-gray-100/50',
  bgHover: 'hover:bg-gray-100',
  bgInput: 'bg-gray-100/70',
  border: 'border-gray-200/50',
  borderLight: 'border-gray-200/40',
  text: 'text-gray-800',
  textSecondary: 'text-slate-600',
  textMuted: 'text-slate-500',
  shadowLg: 'shadow-lg shadow-gray-200/40',
  card: 'bg-white/80 border-gray-200/50',
  cardHover: 'hover:border-gray-300',
  accent: 'brand',
  accentBg: 'bg-brand-500',
  accentText: 'text-brand-500',
  accentLight: 'bg-brand-50',
  floatingPanel: 'bg-white/90 shadow-lg shadow-gray-200/40 border border-gray-200/50 rounded-xl',
};

const desktopDarkTheme = {
  ...darkTheme,
  bg: 'bg-[#09090B]',
  bgSecondary: 'bg-[#18181B]/60',
  bgTertiary: 'bg-white/[0.03]',
  bgHover: 'hover:bg-white/[0.05]',
  bgInput: 'bg-zinc-900/50',
  border: 'border-white/5',
  borderLight: 'border-white/[0.05]',
  text: 'text-gray-200',
  textSecondary: 'text-slate-400',
  textMuted: 'text-slate-500',
  shadowLg: 'shadow-[0_8px_30px_rgba(0,0,0,0.4)]',
  card: 'bg-[#18181B]/80 border-white/10',
  cardHover: 'hover:border-white/[0.15]',
  accent: 'brand',
  accentBg: 'bg-brand-400',
  accentText: 'text-brand-300',
  accentLight: 'bg-brand-400/10',
  floatingPanel: 'bg-[#18181B]/90 shadow-xl shadow-black/40 border border-white/10 rounded-xl',
};

const DESKTOP_QUERY = '(min-width: 1024px)';

function isNativeApp() {
  return typeof window !== 'undefined'
    && typeof window.Capacitor?.isNativePlatform === 'function'
    && window.Capacitor.isNativePlatform() === true;
}

// Electron 桌面壳始终用桌面布局（默认窗口 985 宽，低于 1024 断点）；浏览器里宽屏才用。
function getIsDesktop() {
  if (typeof window === 'undefined' || isNativeApp()) return false;
  return detectRuntime().isDesktopShell || !!window.matchMedia?.(DESKTOP_QUERY).matches;
}

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

  const [isDesktop, setIsDesktop] = useState(getIsDesktop);

  useEffect(() => {
    const media = window.matchMedia?.(DESKTOP_QUERY);
    if (!media) return undefined;
    const handleChange = () => setIsDesktop(getIsDesktop());
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('mqtt_theme', newTheme);
  };

  const mobileTheme = theme === 'light' ? lightTheme : darkTheme;
  const desktopTheme = theme === 'light' ? desktopLightTheme : desktopDarkTheme;
  const t = isDesktop ? desktopTheme : mobileTheme;

  return (
    <ThemeContext.Provider value={{ theme, t, isDesktop, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
