import React from 'react';

export default function TopicInputField({
  pubTopic,
  pubTopicRef,
  setPubTopic,
  setTopicFocused,
  t,
  topicSuggestions,
}) {
  return (
    <div className="flex-1 relative">
      <input
        ref={pubTopicRef}
        type="text"
        value={pubTopic}
        onChange={(e) => setPubTopic(e.target.value)}
        onFocus={() => setTopicFocused(true)}
        onBlur={() => setTimeout(() => setTopicFocused(false), 150)}
        className={`w-full ${t.bgInput} border ${t.border} rounded-xl px-4 py-2.5 text-sm font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all ${t.text}`}
        placeholder="Topic（如 test/topic；多个 Topic 用 , 或 ; 分隔以群发）"
      />
      {topicSuggestions.length > 0 && (
        <div className={`absolute z-20 left-0 right-0 mt-1 ${t.bgSecondary} border ${t.border} rounded-xl shadow-lg max-h-48 overflow-y-auto custom-scrollbar`}>
          {topicSuggestions.slice(0, 15).map((item) => (
            <button
              key={item}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setPubTopic(item);
                setTopicFocused(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm font-mono ${t.text} ${t.bgHover} transition-colors first:rounded-t-xl last:rounded-b-xl truncate`}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
