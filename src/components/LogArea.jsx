import React from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useMqtt } from '../contexts/MqttContext.jsx';
import { useAppData } from '../contexts/AppDataContext.jsx';
import LogAreaEmptyState from './log-area/LogAreaEmptyState.jsx';
import LogAreaHeader from './log-area/LogAreaHeader.jsx';
import LogEntryCard from './log-area/LogEntryCard.jsx';

export default function LogArea() {
  const { theme, t } = useTheme();
  const {
    filteredMessageLogs, logTopicFilters, clearLogTopicFilters,
    logViewMode, isAutoScroll, setIsAutoScroll,
    setLogs, logsEndRef,
    logExportMenuOpen, setLogExportMenuOpen, logExportMenuRef, logExportButtonRef,
    messageLogs, logFilter, setLogFilter,
  } = useMqtt();
  const { exportMessageLogs } = useAppData();

  const handleExportLogs = (scope) => {
    exportMessageLogs(scope, messageLogs, filteredMessageLogs, logTopicFilters, logFilter);
    setLogExportMenuOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <LogAreaHeader
        clearLogTopicFilters={clearLogTopicFilters}
        filteredCount={filteredMessageLogs.length}
        handleExportLogs={handleExportLogs}
        isAutoScroll={isAutoScroll}
        logExportButtonRef={logExportButtonRef}
        logExportMenuOpen={logExportMenuOpen}
        logExportMenuRef={logExportMenuRef}
        logFilter={logFilter}
        logTopicFilters={logTopicFilters}
        onClearLogs={() => setLogs([])}
        setIsAutoScroll={setIsAutoScroll}
        setLogExportMenuOpen={setLogExportMenuOpen}
        setLogFilter={setLogFilter}
        t={t}
        theme={theme}
      />

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-2 sm:space-y-3 custom-scrollbar">
        {filteredMessageLogs.length === 0 ? (
          <LogAreaEmptyState t={t} />
        ) : (
          filteredMessageLogs.map((log) => (
            <LogEntryCard
              key={log.id}
              log={log}
              logViewMode={logViewMode}
              t={t}
              theme={theme}
            />
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
