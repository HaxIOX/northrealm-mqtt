import React from 'react';
import { MessageSquare } from 'lucide-react';

export default function LogAreaEmptyState({ t }) {
  return (
    <div className={`flex flex-col items-center justify-center h-full ${t.textMuted}`}>
      <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
      <p className="text-sm">暂无日志记录</p>
      <p className="text-xs mt-1">连接服务器并订阅主题后，消息将显示在这里</p>
    </div>
  );
}
