import React from 'react';
import { Settings, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useAppData } from '../contexts/AppDataContext.jsx';
import { useModal } from '../contexts/ModalContext.jsx';
import LocalBackupSection from './sync-modal/LocalBackupSection.jsx';

export default function SyncModal() {
  const { theme, t } = useTheme();
  const { openConfirmModal } = useModal();
  const {
    showSyncModal, setShowSyncModal,
    backupImportInputRef, handleExportBackup,
  } = useAppData();

  if (!showSyncModal) return null;

  const handleExportBackupWithPasswords = () => {
    openConfirmModal(
      '导出备份并包含密码？（文件将包含明文密码，请妥善保管）',
      () => handleExportBackup(true),
      { confirmText: '继续导出', confirmVariant: 'danger' }
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-md">
      <div className={`${t.bgSecondary} rounded-2xl shadow-2xl max-w-md w-full border ${t.border} p-6`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-bold flex items-center gap-2 ${t.text}`}><Settings className="w-5 h-5 text-indigo-500"/> 备份与导入</h3>
          <button onClick={() => setShowSyncModal(false)} className={`${t.textMuted} hover:${t.text} p-1 ${t.bgHover} rounded-lg transition-colors`}><X className="w-5 h-5"/></button>
        </div>

        <LocalBackupSection
          backupImportInputRef={backupImportInputRef}
          handleExportBackup={handleExportBackup}
          handleExportBackupWithPasswords={handleExportBackupWithPasswords}
          t={t}
          theme={theme}
        />

      </div>
    </div>
  );
}
