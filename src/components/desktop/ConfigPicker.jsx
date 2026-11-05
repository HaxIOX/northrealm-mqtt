import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Trash2 } from 'lucide-react';

// 配置下拉：自绘以显示“协议://主机:端口”并支持行内删除。
// 面板用 fixed 定位，避免被侧栏的滚动容器裁剪；下方空间不足时向上展开。
export default function ConfigPicker({ configs, currentName, onSelect, onDelete, t, theme }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  const toggle = () => {
    if (open) { close(); return; }
    const r = triggerRef.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 8;
    const up = below < 140 && r.top > below;
    const room = (up ? r.top : below) - 8;
    setPos({
      left: r.left,
      // 比触发按钮略宽，让“协议://主机:端口”不被截断；不超出窗口右边缘
      width: Math.min(Math.max(r.width, 260), window.innerWidth - r.left - 8),
      maxHeight: Math.min(240, room),
      ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => !panelRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target);
    const onDown = (e) => { if (outside(e)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const onScroll = (e) => { if (!panelRef.current?.contains(e.target)) close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  const pick = (c) => { onSelect(c); close(); };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex-1 min-w-0 flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left text-[13px] transition-all ${t.bgInput} ${t.border} ${open ? 'border-brand-500 ring-2 ring-brand-500/20' : ''}`}
      >
        <span className={`min-w-0 truncate ${currentName ? t.text : 'text-slate-400'}`}>{currentName || '选择配置'}</span>
        <ChevronDown size={14} className={`shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && pos && (
        <div
          ref={panelRef}
          role="listbox"
          style={pos}
          className={`fixed z-40 overflow-y-auto custom-scrollbar rounded-lg border p-1 shadow-xl text-gray-800 dark:text-gray-200 ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-[#18181B] border-white/10'}`}
        >
          {configs.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-slate-400">暂无已保存配置，点右侧按钮保存</div>
          ) : configs.map((c) => {
            const active = c.name === currentName;
            return (
              <div
                key={c.name}
                role="option"
                aria-selected={active}
                tabIndex={0}
                onClick={() => pick(c)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(c); } }}
                className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${active ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium truncate">{c.name}</div>
                  <div className="text-[11px] font-mono truncate opacity-60">{`${c.protocol}://${c.host}:${c.port}`}</div>
                </div>
                {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                <button
                  type="button"
                  title="删除"
                  aria-label={`删除配置 ${c.name}`}
                  onClick={(e) => { e.stopPropagation(); close(); onDelete(c.name); }}
                  className="shrink-0 p-1 rounded text-slate-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-rose-500 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
