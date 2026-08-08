import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';

export default function ConfirmModal({ modal, onSubmit, onClose, onInputChange }) {
  const { t } = useTheme();
  if (!modal.open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[90] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`${t.bgSecondary} rounded-2xl shadow-2xl max-w-sm w-full border ${t.border} p-6 transform scale-100`}>
        <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${t.text}`}>
          {modal.type === 'confirm' && <AlertCircle className="w-5 h-5 text-amber-500" />}
          {modal.title}
        </h3>
        {modal.type === 'input' && (
          <input
            autoFocus type="text" value={modal.inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            className={`w-full ${t.bgInput} border ${t.border} rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none mb-4 transition-all ${t.text}`}
          />
        )}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className={`px-4 py-2 ${t.bgTertiary} ${t.bgHover} rounded-xl text-sm font-medium transition-colors ${t.textSecondary}`}>取消</button>
          <button
            onClick={onSubmit}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg ${
              modal.type === 'confirm'
                ? (modal.confirmVariant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20')
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
            }`}
          >
            {modal.type === 'confirm' ? (modal.confirmText || '确定') : '确定保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
