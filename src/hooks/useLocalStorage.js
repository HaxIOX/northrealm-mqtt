import { useState, useEffect } from 'react';

function getStorage(kind) {
  return kind === 'session' ? globalThis.sessionStorage : globalThis.localStorage;
}

function readStorageEntry(kind, key) {
  try {
    const raw = getStorage(kind)?.getItem(key);
    return { found: raw != null, raw };
  } catch {
    return { found: false, raw: null };
  }
}

function parseJson(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function readStorageString(kind, key, fallback = '') {
  const { found, raw } = readStorageEntry(kind, key);
  return found ? raw : fallback;
}

export function writeStorageString(kind, key, value) {
  try {
    getStorage(kind)?.setItem(key, String(value));
  } catch {
    // ignore
  }
}

export function removeStorageItem(kind, key) {
  try {
    getStorage(kind)?.removeItem(key);
  } catch {
    // ignore
  }
}

export function readStorageJson(kind, key, fallback = null) {
  const { found, raw } = readStorageEntry(kind, key);
  if (!found) return fallback;
  return parseJson(raw, fallback);
}

export function readStorageJsonArray(kind, key, fallback = null) {
  const { found, raw } = readStorageEntry(kind, key);
  if (!found) return fallback;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    removeStorageItem(kind, key);
    return fallback;
  }
}

export function readStorageJsonObject(kind, key, fallback = null) {
  const parsed = readStorageJson(kind, key, fallback);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
}

export function writeStorageJson(kind, key, value) {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      removeStorageItem(kind, key);
      return;
    }
    getStorage(kind)?.setItem(key, serialized);
  } catch {
    // ignore
  }
}

export function readStorageFlag(kind, key, defaultValue = false) {
  const { found, raw } = readStorageEntry(kind, key);
  if (!found) return defaultValue;
  return raw === '1';
}

export function writeStorageFlag(kind, key, value) {
  writeStorageString(kind, key, value ? '1' : '0');
}

export function readLocalStorageString(key, fallback = '') {
  return readStorageString('local', key, fallback);
}

export function writeLocalStorageString(key, value) {
  writeStorageString('local', key, value);
}

export function removeLocalStorageItem(key) {
  removeStorageItem('local', key);
}

export function readLocalStorageJson(key, fallback = null) {
  return readStorageJson('local', key, fallback);
}

export function readLocalStorageJsonArray(key, fallback = null) {
  return readStorageJsonArray('local', key, fallback);
}

export function readLocalStorageJsonObject(key, fallback = null) {
  return readStorageJsonObject('local', key, fallback);
}

export function writeLocalStorageJson(key, value) {
  writeStorageJson('local', key, value);
}

export function readLocalStorageFlag(key, defaultValue = false) {
  return readStorageFlag('local', key, defaultValue);
}

export function writeLocalStorageFlag(key, value) {
  writeStorageFlag('local', key, value);
}

export function readSessionStorageString(key, fallback = '') {
  return readStorageString('session', key, fallback);
}

export function writeSessionStorageString(key, value) {
  writeStorageString('session', key, value);
}

export function removeSessionStorageItem(key) {
  removeStorageItem('session', key);
}

export function readSessionStorageFlag(key, defaultValue = false) {
  return readStorageFlag('session', key, defaultValue);
}

export function writeSessionStorageFlag(key, value) {
  writeStorageFlag('session', key, value);
}

export function useLocalStorageState(key, initialValue) {
  const [value, setValue] = useState(() => readLocalStorageJson(key, initialValue));

  useEffect(() => {
    writeLocalStorageJson(key, value);
  }, [key, value]);

  return [value, setValue];
}

export function useLocalStorageFlag(key, defaultValue = false) {
  const [value, setValue] = useState(() => readLocalStorageFlag(key, defaultValue));

  useEffect(() => {
    writeLocalStorageFlag(key, value);
  }, [key, value]);

  return [value, setValue];
}
