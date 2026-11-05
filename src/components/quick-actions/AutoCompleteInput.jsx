import React, { useState } from 'react';
import { getVarHistory } from './quickActionUtils.jsx';

export function AutoCompleteInput({ varName, value, onChange, t, placeholder, autoFocus }) {
  const [focused, setFocused] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const history = getVarHistory(varName);
  const query = (value || '').toLowerCase();
  const suggestions = query
    ? history.filter((item) => item.toLowerCase().includes(query) && item !== value)
    : history.filter((item) => item !== value);
  const options = forceOpen ? history : suggestions;
  const showDropdown = (focused || forceOpen) && options.length > 0;

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => { setFocused(false); setForceOpen(false); }, 150)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`w-full pl-3 pr-8 py-2 ${t.bgInput} border ${t.border} rounded-xl text-sm ${t.text} focus:outline-none focus:ring-2 ${t.focusRing}`}
      />
      {history.length > 0 && (
        <button
          type="button"
          tabIndex={-1}
          title="历史值"
          onMouseDown={(e) => { e.preventDefault(); setForceOpen((v) => !v); }}
          className={`absolute right-1 top-1/2 -translate-y-1/2 px-1.5 py-1 text-xs ${t.textMuted} ${t.bgHover} rounded-lg`}
        >▾</button>
      )}
      {showDropdown && (
        <div className={`absolute z-10 left-0 right-0 mt-1 ${t.bgSecondary} border ${t.border} rounded-xl shadow-lg max-h-40 overflow-y-auto custom-scrollbar`}>
          {options.map((item) => (
            <button
              key={item}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(item);
                setFocused(false);
                setForceOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm ${t.text} ${t.bgHover} transition-colors first:rounded-t-xl last:rounded-b-xl`}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
