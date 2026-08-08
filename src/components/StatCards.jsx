import React from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useMqtt } from '../contexts/MqttContext.jsx';

export default function StatCards() {
  const { t } = useTheme();
  const { msgStats } = useMqtt();

  return (
    <div className="px-6 pb-4">
      <div className="grid grid-cols-3 gap-2">
        <div className={`${t.card} p-3 rounded-xl border text-center ${t.shadow}`}>
          <p className="text-lg font-bold text-blue-500">{msgStats.sent}</p>
          <p className={`text-[10px] ${t.textMuted}`}>发送</p>
        </div>
        <div className={`${t.card} p-3 rounded-xl border text-center ${t.shadow}`}>
          <p className="text-lg font-bold text-emerald-500">{msgStats.received}</p>
          <p className={`text-[10px] ${t.textMuted}`}>接收</p>
        </div>
        <div className={`${t.card} p-3 rounded-xl border text-center ${t.shadow}`}>
          <p className="text-lg font-bold text-rose-500">{msgStats.errors}</p>
          <p className={`text-[10px] ${t.textMuted}`}>错误</p>
        </div>
      </div>
    </div>
  );
}
