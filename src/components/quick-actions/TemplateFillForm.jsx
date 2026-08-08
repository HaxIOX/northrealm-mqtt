import React, { useState } from 'react';
import { ArrowLeft, Zap } from 'lucide-react';
import {
  readLocalStorageJsonObject,
  writeLocalStorageJson,
} from '../../hooks/useLocalStorage.js';
import { extractTemplateVars } from '../../utils/mqtt-helpers.js';
import { AutoCompleteInput } from './AutoCompleteInput.jsx';
import { pushVarHistory, renderTemplateStr } from './quickActionUtils.jsx';

export function TemplateFillForm({ action, theme, t, onSubmit, onCancel }) {
  const combined = `${action?.topic || ''}${action?.payload || ''}`;
  const vars = extractTemplateVars(combined);
  const storageKey = `mqtt_action_vars_${action?.id}`;
  const [values, setValues] = useState(() => readLocalStorageJsonObject(storageKey, {}) || {});

  const handleSubmit = (e) => {
    e.preventDefault();
    writeLocalStorageJson(storageKey, values);

    for (const name of vars) {
      const nextValue = (values[name] || '').trim();
      if (nextValue) pushVarHistory(name, nextValue);
    }

    onSubmit(values);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className={`p-1.5 rounded-lg ${t.bgTertiary} ${t.bgHover} transition-colors`}
        >
          <ArrowLeft className={`w-4 h-4 ${t.textMuted}`} />
        </button>
        <div className="min-w-0">
          <div className={`font-bold text-sm ${t.text} truncate`}>{action.name}</div>
          <div className={`text-[11px] ${t.textMuted}`}>填写模板变量后发送</div>
        </div>
      </div>

      <div className={`p-3 rounded-xl ${t.bgTertiary} border ${t.border} font-mono text-xs space-y-1`}>
        <div className={`${t.textMuted} flex items-center gap-1 flex-wrap`}>
          Topic:
          <span className={t.textSecondary}>{renderTemplateStr(action.topic, theme)}</span>
        </div>
        <div className={`${t.textMuted} flex items-center gap-1 flex-wrap`}>
          Payload:
          <span className={t.textSecondary}>{renderTemplateStr(String(action.payload || ''), theme)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {vars.map((name, index) => (
          <div key={name}>
            <label className={`text-xs font-medium mb-1 flex items-center gap-1.5 ${theme === 'light' ? 'text-purple-600' : 'text-purple-300'}`}>
              {name}
            </label>
            <AutoCompleteInput
              varName={name}
              value={values[name] || ''}
              onChange={(nextValue) => setValues((prev) => ({ ...prev, [name]: nextValue }))}
              t={t}
              placeholder={name}
              autoFocus={index === 0}
            />
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${theme === 'light' ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'}`}
          >
            <Zap className="w-4 h-4" /> 发送
          </button>
          <button
            type="button"
            onClick={onCancel}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium ${t.bgTertiary} ${t.textSecondary} border ${t.border} ${t.bgHover}`}
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
