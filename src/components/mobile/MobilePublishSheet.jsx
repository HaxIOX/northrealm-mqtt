import React, { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { useMqtt } from '../../contexts/MqttContext.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';

export default function MobilePublishSheet({ open, onClose }) {
  const { theme, t } = useTheme();
  const {
    client,
    handlePublish,
    pubMessage,
    pubTopic,
    setPubMessage,
    setPubTopic,
  } = useMqtt();
  const topicRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const canPublish = Boolean(client?.connected && pubTopic.trim() && !submitting);

  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement;
    const frame = requestAnimationFrame(() => topicRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      previousFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const publish = () => {
    if (!canPublish) return;

    setSubmitting(true);
    try {
      const accepted = handlePublish({
        onSuccess: () => {
          setSubmitting(false);
          onClose();
        },
        onError: () => setSubmitting(false),
      });
      if (accepted === false) setSubmitting(false);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/45 backdrop-blur-sm lg:hidden">
      <button
        type="button"
        aria-label="关闭发送面板"
        tabIndex={-1}
        className="absolute inset-0"
        onClick={onClose}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-publish-title"
        className={`relative z-10 w-full rounded-t-2xl border-t ${t.bgSecondary} ${t.border} shadow-2xl`}
        style={{
          maxHeight: 'calc(var(--app-viewport-height, 100dvh) - var(--app-safe-top, 0px) - 12px)',
          paddingBottom: 'max(var(--app-safe-bottom, 0px), 12px)',
        }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-400/50" />
        <div className="flex items-center justify-between px-4 py-3">
          <h2 id="mobile-publish-title" className={`text-base font-semibold ${t.text}`}>发送消息</h2>
          <button
            type="button"
            aria-label="关闭发送面板"
            onClick={onClose}
            className={`flex h-9 w-9 items-center justify-center rounded-full ${t.bgTertiary} ${t.textSecondary}`}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div
          className="flex flex-col gap-3 overflow-y-auto px-4 pb-3"
          style={{ maxHeight: 'calc(var(--app-viewport-height, 100dvh) - var(--app-safe-top, 0px) - 76px)' }}
        >
          <label className={`text-xs font-medium ${t.textSecondary}`} htmlFor="mobile-publish-topic">Topic</label>
          <input
            ref={topicRef}
            id="mobile-publish-topic"
            type="text"
            value={pubTopic}
            onChange={(event) => setPubTopic(event.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className={`h-11 w-full rounded-lg border px-3 text-sm outline-none focus:border-current focus:ring-2 focus:ring-current/20 ${t.bgInput} ${t.border} ${t.text}`}
            placeholder="topic/name"
          />

          <label className={`text-xs font-medium ${t.textSecondary}`} htmlFor="mobile-publish-payload">Payload</label>
          <textarea
            id="mobile-publish-payload"
            value={pubMessage}
            onChange={(event) => setPubMessage(event.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            rows={5}
            className={`min-h-28 w-full resize-y rounded-lg border px-3 py-2 font-mono text-sm outline-none focus:border-current focus:ring-2 focus:ring-current/20 ${t.bgInput} ${t.border} ${t.text}`}
            placeholder="Payload"
          />

          <button
            type="button"
            disabled={!canPublish}
            onClick={publish}
            className={`flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${theme === 'light' ? 'bg-black text-white hover:bg-neutral-800' : 'bg-white text-black hover:bg-neutral-200'}`}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span>{submitting ? '发送中' : '发送'}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
