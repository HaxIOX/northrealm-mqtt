import React from 'react';
import {
  readLocalStorageJsonArray,
  writeLocalStorageJson,
} from '../../hooks/useLocalStorage.js';

export function renderTemplateStr(str, theme) {
  if (!str) return null;

  const parts = [];
  let last = 0;
  const regex = /\{\{(\w+)\}\}/g;
  let match;

  while ((match = regex.exec(str)) !== null) {
    if (match.index > last) {
      parts.push(<span key={`t${last}`}>{str.slice(last, match.index)}</span>);
    }

    parts.push(
      <span
        key={`v${match.index}`}
        className={`inline-block px-1 rounded font-semibold ${
          theme === 'light'
            ? 'bg-purple-100 text-purple-700'
            : 'bg-purple-500/20 text-purple-300'
        }`}
      >
        {match[1]}
      </span>
    );

    last = match.index + match[0].length;
  }

  if (last < str.length) {
    parts.push(<span key={`t${last}`}>{str.slice(last)}</span>);
  }

  return parts;
}

export function pushVarHistory(varName, value) {
  const key = `mqtt_tpl_history_${varName}`;
  const history = readLocalStorageJsonArray(key, []) || [];
  const next = [value, ...history.filter((item) => item !== value)].slice(0, 20);
  writeLocalStorageJson(key, next);
}

export function getVarHistory(varName) {
  return readLocalStorageJsonArray(`mqtt_tpl_history_${varName}`, []) || [];
}

export function splitNameByPrefix(rawName) {
  const name = String(rawName || '').trim();
  if (!name) return { group: '未分组', displayName: '' };

  const candidates = ['/', '::', ':', '：'];
  let best = null;

  for (const sep of candidates) {
    const idx = name.indexOf(sep);
    if (idx <= 0 || idx >= name.length - sep.length) continue;

    if (!best || idx < best.idx || (idx === best.idx && sep.length > best.sep.length)) {
      best = { idx, sep };
    }
  }

  if (!best) return { group: '未分组', displayName: name };

  const group = name.slice(0, best.idx).trim();
  const displayName = name.slice(best.idx + best.sep.length).trim();

  if (!group || !displayName) {
    return { group: '未分组', displayName: name };
  }

  return { group, displayName };
}
