import React from 'react';

export default function SyncDisabledNotice() {
  return (
    <div className="p-4 bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-xl text-amber-800 dark:text-amber-200 text-sm">
      <p className="font-bold mb-1">云同步未启用</p>
      <p className="text-xs opacity-80">当前环境未配置 Firebase，仅可使用本地备份/导入导出。</p>
    </div>
  );
}
