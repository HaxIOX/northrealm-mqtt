import React, { useMemo, useState } from 'react';
import { Check, Copy, Edit2 } from 'lucide-react';
import { toHex } from '../../utils/formatters.js';

const isJson = (str) => { try { JSON.parse(str); return true; } catch { return false; } };
const tryFormatJson = (str) => { try { return JSON.stringify(JSON.parse(str), null, 2); } catch { return str; } };

// 轻量 JSON tokenizer：切分为 {type,value} 序列，供语法着色使用
function tokenizeJson(text) {
  const tokens = [];
  let i = 0;
  const n = text.length;
  const push = (type, value) => { if (value) tokens.push({ type, value }); };
  while (i < n) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      let str = c;
      while (j < n) {
        const ch = text[j];
        str += ch;
        j++;
        if (ch === '\\') { if (j < n) { str += text[j]; j++; } continue; }
        if (ch === '"') break;
      }
      push('string', str);
      i = j;
    } else if (c === '{' || c === '}' || c === '[' || c === ']' || c === ':' || c === ',') {
      push('punct', c);
      i++;
    } else if (/\s/.test(c)) {
      let j = i;
      while (j < n && /\s/.test(text[j])) j++;
      push('whitespace', text.slice(i, j));
      i = j;
    } else {
      const numMatch = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i));
      if (numMatch) { push('number', numMatch[0]); i += numMatch[0].length; continue; }
      const wordMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i));
      if (wordMatch) {
        const w = wordMatch[0];
        if (w === 'true' || w === 'false') push('boolean', w);
        else if (w === 'null') push('null', w);
        else push('other', w);
        i += w.length;
        continue;
      }
      push('other', c);
      i++;
    }
  }
  // 字符串后（跳过空白）紧跟 ':' 视为键
  for (let k = 0; k < tokens.length; k++) {
    if (tokens[k].type !== 'string') continue;
    let p = k + 1;
    while (p < tokens.length && tokens[p].type === 'whitespace') p++;
    if (p < tokens.length && tokens[p].type === 'punct' && tokens[p].value === ':') tokens[k].type = 'key';
  }
  return tokens;
}

function JsonHighlight({ text, theme }) {
  const tokens = useMemo(() => tokenizeJson(text), [text]);
  const cls = {
    key: theme === 'light' ? 'text-[#2563eb]' : 'text-[#60a5fa]/80',
    string: theme === 'light' ? 'text-emerald-700' : 'text-emerald-400/70',
    number: theme === 'light' ? 'text-amber-600' : 'text-amber-400/70',
    boolean: theme === 'light' ? 'text-violet-600' : 'text-[#FB7185]/80',
    null: theme === 'light' ? 'text-violet-600' : 'text-[#FB7185]/80',
    other: theme === 'light' ? 'text-slate-600' : 'text-[#94A3B8]',
    punct: theme === 'light' ? 'text-slate-500' : 'text-[#94A3B8]',
    whitespace: '',
  };
  return tokens.map((tok, idx) => (
    cls[tok.type] ? <span key={idx} className={cls[tok.type]}>{tok.value}</span> : tok.value
  ));
}

export // 复制按钮：点击后 1.5 秒内显示对勾，作为复制成功反馈
function CopyButton({ text, className, title = '复制' }) {
  const [copied, setCopied] = useState(false);
  const handleClick = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(String(text ?? ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };
  return (
    <button type="button" onClick={handleClick} className={className} title={copied ? '已复制' : title} aria-label={title}>
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

const DesktopLogItem = React.memo(function DesktopLogItem({ log, theme, logViewMode, onEdit }) {
  const isSent = log.type === 'sent';
  const isReceived = log.type === 'received';
  const isSystem = log.type === 'system';
  const isError = !isSent && !isReceived && !isSystem;
  const tagLabel = isSent ? 'TX' : isReceived ? 'RX' : isError ? 'ERR' : 'SYS';

  const tagCls = isSent
    ? (theme === 'light' ? 'text-[#2563eb]' : 'text-[#60a5fa]/80')
    : isReceived
      ? (theme === 'light' ? 'text-emerald-600' : 'text-emerald-400/70')
      : isError
        ? (theme === 'light' ? 'text-rose-600' : 'text-rose-400/80')
        : (theme === 'light' ? 'text-slate-500' : 'text-gray-400');

  const mutedText = theme === 'light' ? 'text-slate-400' : 'text-gray-500';
  const secondaryText = theme === 'light' ? 'text-slate-600' : 'text-gray-300';
  const hoverBtn = theme === 'light' ? 'text-slate-400 hover:text-slate-700' : 'text-gray-500 hover:text-gray-200';

  const showEdit = !!log.topic && typeof log.payload === 'string' && onEdit;

  return (
    <div className="group flex flex-col gap-1.5 py-2.5 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors rounded-lg px-2 -mx-2">
      <div className="flex items-center gap-3 text-[11px] w-full">
        <span className={`text-[11px] font-mono ${mutedText} shrink-0 font-medium`}>{log.timestamp}</span>
        <span className={`text-[11px] font-bold tracking-wider uppercase shrink-0 ${tagCls}`}>{tagLabel}</span>
        {log.topic && <span className={`text-[11px] font-mono truncate opacity-90 ${secondaryText}`} title={log.topic}>{log.topic}</span>}
        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {showEdit && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(log); }} className={`p-1 ${hoverBtn} rounded-lg transition-colors`} title="填充到发送区编辑">
                <Edit2 className="w-3 h-3" />
              </button>
          )}
          <CopyButton text={log.payload} title="复制 Payload" className={`p-1 ${hoverBtn} rounded-lg transition-colors`} />
        </div>
      </div>
      <pre className={`text-[13px] leading-relaxed overflow-x-auto whitespace-pre-wrap ${isSent || isReceived ? 'font-mono break-all' : 'font-sans break-words'}`}>
        {logViewMode === 'hex' ? (
          <span className={theme === 'light' ? 'text-purple-600' : 'text-gray-400'}>{toHex(log.payload)}</span>
        ) : typeof log.payload === 'string' && isJson(log.payload) ? (
          <JsonHighlight text={tryFormatJson(log.payload)} theme={theme} />
        ) : (
          String(log.payload ?? '')
        )}
      </pre>
      {!!log.details && (
        <div className={`text-xs leading-relaxed whitespace-pre-wrap break-words ${mutedText}`}>{log.details}</div>
      )}
    </div>
  );
});

export default DesktopLogItem;
