import React, { useRef, useCallback, useEffect, useState } from 'react';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext.jsx';
import { AppDataProvider, useAppData } from '../contexts/AppDataContext.jsx';
import { MqttProvider, useMqtt } from '../contexts/MqttContext.jsx';
import { ModalProvider } from '../contexts/ModalContext.jsx';
import { detectRuntime } from '../mqtt/runtime.js';
import PublishEditorModal from '../components/PublishEditorModal.jsx';
import QuickActionsModal from '../components/QuickActionsModal.jsx';
import MulticastModal from '../components/MulticastModal.jsx';
import SyncModal from '../components/SyncModal.jsx';
import Sidebar from '../components/Sidebar.jsx';
import MainContent from '../components/MainContent.jsx';
import MobileActionMenu from '../components/mobile/MobileActionMenu.jsx';
import MobileConnectionModal from '../components/mobile/MobileConnectionModal.jsx';
import MobilePublishSheet from '../components/mobile/MobilePublishSheet.jsx';
import TopicFilterDrawer from '../components/mobile/TopicFilterDrawer.jsx';

function AddLogBridge({ addLogRef }) {
  const { addLog } = useMqtt();
  useEffect(() => { addLogRef.current = addLog; }, [addLog, addLogRef]);
  return null;
}

function AppShell() {
  const { theme, t } = useTheme();
  const { backupImportInputRef, handleImportBackupFileChange } = useAppData();
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [mobileConnectionOpen, setMobileConnectionOpen] = useState(false);
  const [mobilePublishOpen, setMobilePublishOpen] = useState(false);
  const [topicFilterOpen, setTopicFilterOpen] = useState(false);
  const edgeGestureRef = useRef(null);
  const isNativeMobile = typeof window !== 'undefined'
    && !!window.Capacitor
    && typeof window.Capacitor.isNativePlatform === 'function'
    && window.Capacitor.isNativePlatform() === true;

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;

    const updateViewportHeight = () => {
      document.documentElement.style.setProperty('--app-viewport-height', `${Math.round(viewport.height)}px`);
    };

    updateViewportHeight();
    viewport.addEventListener('resize', updateViewportHeight);
    return () => {
      viewport.removeEventListener('resize', updateViewportHeight);
      document.documentElement.style.removeProperty('--app-viewport-height');
    };
  }, []);

  useEffect(() => {
    const closeTopmostOverlay = () => {
      if (mobilePublishOpen) setMobilePublishOpen(false);
      else if (mobileConnectionOpen) setMobileConnectionOpen(false);
      else if (topicFilterOpen) setTopicFilterOpen(false);
      else if (mobileActionsOpen) setMobileActionsOpen(false);
      else return false;
      return true;
    };
    const handleBack = (event) => {
      if (closeTopmostOverlay()) event?.preventDefault?.();
    };
    document.addEventListener('backbutton', handleBack);
    return () => document.removeEventListener('backbutton', handleBack);
  }, [mobileActionsOpen, mobileConnectionOpen, mobilePublishOpen, topicFilterOpen]);

  const closeMobileConnection = useCallback(() => setMobileConnectionOpen(false), []);
  const closeMobilePublish = useCallback(() => setMobilePublishOpen(false), []);
  const closeTopicFilter = useCallback(() => setTopicFilterOpen(false), []);
  const openMobileConnection = useCallback(() => {
    setTopicFilterOpen(false);
    setMobilePublishOpen(false);
    setMobileConnectionOpen(true);
  }, []);
  const openMobilePublish = useCallback(() => {
    setTopicFilterOpen(false);
    setMobileConnectionOpen(false);
    setMobilePublishOpen(true);
  }, []);
  const openTopicFilter = useCallback(() => {
    setMobileActionsOpen(false);
    setMobileConnectionOpen(false);
    setMobilePublishOpen(false);
    setTopicFilterOpen(true);
  }, []);

  const handlePointerDown = (event) => {
    if (
      !window.matchMedia('(max-width: 1023px)').matches
      || !event.isPrimary
      || (event.pointerType === 'mouse' && event.button !== 0)
      || event.clientX > 24
      || mobileActionsOpen
      || mobilePublishOpen
      || mobileConnectionOpen
      || topicFilterOpen
    ) return;
    edgeGestureRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event) => {
    const start = edgeGestureRef.current;
    edgeGestureRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (deltaX >= 64 && deltaX > Math.abs(deltaY) * 1.25) {
      openTopicFilter();
    }
  };

  return (
    <div
      className={`min-h-0 overflow-hidden flex ${t.bg} ${theme === 'dark' ? 'dark' : ''}`}
      style={{
        '--app-safe-bottom': isNativeMobile ? 'max(env(safe-area-inset-bottom), 24px)' : '0px',
        '--app-safe-top': isNativeMobile ? 'max(env(safe-area-inset-top), 24px)' : '0px',
        boxSizing: 'border-box',
        height: 'var(--app-viewport-height, 100dvh)',
        paddingTop: 'var(--app-safe-top)',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { edgeGestureRef.current = null; }}
    >
      <PublishEditorModal />
      <QuickActionsModal />
      <MulticastModal />
      <SyncModal />
      <Sidebar mobileOpen={false} />
      <MainContent onOpenTopicFilters={openTopicFilter} />
      {!mobileConnectionOpen && !mobilePublishOpen && !topicFilterOpen && (
        <MobileActionMenu
          open={mobileActionsOpen}
          onToggle={setMobileActionsOpen}
          onConnection={openMobileConnection}
          onPublish={openMobilePublish}
        />
      )}
      {mobileConnectionOpen && <MobileConnectionModal open onClose={closeMobileConnection} />}
      {mobilePublishOpen && <MobilePublishSheet open onClose={closeMobilePublish} />}
      {topicFilterOpen && <TopicFilterDrawer open onClose={closeTopicFilter} />}
      <input
        ref={backupImportInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportBackupFileChange}
      />
      <style>{`
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: ${theme === 'light' ? '#cbd5e1' : '#334155'} transparent; scrollbar-gutter: stable; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${theme === 'light' ? '#cbd5e1' : '#334155'}; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: ${theme === 'light' ? '#94a3b8' : '#475569'}; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in-from-bottom-2 { from { transform: translateY(8px); } to { transform: translateY(0); } }
        @keyframes slide-in-from-top-2 { from { transform: translateY(-8px); } to { transform: translateY(0); } }
        .animate-in { animation: fade-in 0.2s ease-out, slide-in-from-bottom-2 0.2s ease-out; }
      `}</style>
    </div>
  );
}

export default function App() {
  const addLogRef = useRef((...args) => console.log('[pre-init]', ...args));
  const { isDesktopShell } = detectRuntime();
  const addLog = useCallback((...args) => addLogRef.current(...args), []);

  return (
    <ThemeProvider>
      <ModalProvider>
        <AppDataProvider isDesktopShell={isDesktopShell} addLog={addLog}>
          <MqttProvider>
            <AddLogBridge addLogRef={addLogRef} />
            <AppShell />
          </MqttProvider>
        </AppDataProvider>
      </ModalProvider>
    </ThemeProvider>
  );
}
