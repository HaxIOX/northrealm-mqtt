import React from 'react';
import { AlertCircle, Download, FileJson, FileText, Settings, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useAppData } from '../../contexts/AppDataContext.jsx';
import { useModal } from '../../contexts/ModalContext.jsx';

// 桌面端“备份”弹窗（v0.1.15 外观）：只做本地导出 / 导入。
export default function DesktopBackupModal({ onClose }) {
  const { theme, t } = useTheme();
  const { openConfirmModal } = useModal();
  const { handleExportBackup, backupImportInputRef } = useAppData();
  const btnCls = `flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${t.bgSecondary} ${t.textSecondary} border ${t.border} ${t.bgHover}`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-md">
      <div className={`${t.floatingPanel} max-w-md w-full p-6`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-bold flex items-center gap-2 ${t.text}`}><Settings className="w-5 h-5 text-brand-500" /> 备份</h3>
          <button onClick={onClose} className={`${t.textMuted} p-1 ${t.bgHover} rounded-lg transition-colors`} aria-label="关闭"><X className="w-5 h-5" /></button>
        </div>

        <div className={`p-4 ${t.bgTertiary} border ${t.border} rounded-xl space-y-3`}>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-500" />
            <div className={`text-sm font-semibold ${t.text}`}>本地备份</div>
            <div className={`text-xs ${t.textMuted}`}>（默认不包含密码）</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleExportBackup(false)} className={btnCls}>
              <Download className="w-4 h-4" /><span>导出</span>
            </button>
            <button onClick={() => backupImportInputRef.current?.click()} className={btnCls}>
              <FileJson className="w-4 h-4" /><span>导入</span>
            </button>
          </div>
          <button
            onClick={() => openConfirmModal('导出备份并包含密码？（文件将包含明文密码，请妥善保管）', () => handleExportBackup(true))}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
              theme === 'light'
                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/20'
            }`}
            title="导出备份（包含密码，明文）"
          >
            <AlertCircle className="w-4 h-4" /><span>导出（含密码）</span>
          </button>
        </div>
      </div>
    </div>
  );
}
