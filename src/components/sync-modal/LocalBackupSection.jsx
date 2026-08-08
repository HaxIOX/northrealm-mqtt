import React from 'react';
import { AlertCircle, Download, FileJson, FileText } from 'lucide-react';

export default function LocalBackupSection({
  backupImportInputRef,
  handleExportBackup,
  handleExportBackupWithPasswords,
  t,
  theme,
}) {
  return (
    <div className={`p-4 ${t.bgTertiary} border ${t.border} rounded-xl space-y-3 mb-4`}>
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-indigo-500" />
        <div className={`text-sm font-semibold ${t.text}`}>本地备份</div>
        <div className={`text-xs ${t.textMuted}`}>（默认不包含密码）</div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => handleExportBackup(false)} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${t.bgSecondary} ${t.textSecondary} border ${t.border} ${t.bgHover}`}>
          <Download className="w-4 h-4" /><span>导出</span>
        </button>
        <button onClick={() => backupImportInputRef.current?.click()} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${t.bgSecondary} ${t.textSecondary} border ${t.border} ${t.bgHover}`}>
          <FileJson className="w-4 h-4" /><span>导入</span>
        </button>
      </div>
      <button
        onClick={handleExportBackupWithPasswords}
        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${theme === 'light' ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' : 'bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/20'}`}
        title="导出备份（包含密码，明文）"
      >
        <AlertCircle className="w-4 h-4" /><span>导出（含密码）</span>
      </button>
    </div>
  );
}
