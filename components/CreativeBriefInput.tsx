import React, { useState } from 'react';

interface CreativeBriefInputProps {
  onBriefSubmit: (brief: string) => void;
  disabled?: boolean;
}

export const CreativeBriefInput: React.FC<CreativeBriefInputProps> = ({ onBriefSubmit, disabled }) => {
  const [brief, setBrief] = useState('');
  const wordCount = brief.trim() === '' ? 0 : brief.trim().split(/\s+/).length;

  const handleSubmit = () => {
    if (brief.trim()) {
      onBriefSubmit(brief);
    }
  };

  return (
    <div className="w-full p-6 sm:p-8 bg-slate-900/50 rounded-xl shadow-2xl border border-cyan-500/10 flex flex-col items-center space-y-6">
      <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent text-center">输入您的创意简介</h2>
      <p className="text-slate-400 text-center max-w-2xl">
        请在此处粘贴您的核心创意、故事大纲或灵感片段。内容越详细，AI 的分析结果越精准。推荐字数在 500 - 2000 字之间。
      </p>
      <textarea
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        disabled={disabled}
        placeholder="在此处粘贴您的创意简介或故事大纲..."
        className="w-full h-72 p-4 bg-slate-900/70 border-2 border-slate-700 rounded-lg shadow-inner focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition-colors duration-200 resize-y disabled:bg-slate-800 text-slate-300 placeholder-slate-500"
        aria-label="创意简介输入框"
      />
       <div className="w-full flex justify-between items-center flex-wrap gap-4">
        <p className="text-sm text-slate-500">当前字数: {wordCount}</p>
        <button
          onClick={handleSubmit}
          disabled={disabled || !brief.trim() || wordCount < 100}
          className="px-10 py-4 bg-gradient-to-br from-cyan-600 to-sky-700 hover:from-cyan-500 hover:to-sky-600 text-white font-bold rounded-lg shadow-lg hover:shadow-cyan-500/20 transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-md focus:outline-none focus:ring-4 focus:ring-cyan-300/50 text-lg"
        >
          开始可行性分析
        </button>
      </div>
       <p className="text-xs text-slate-600 text-center w-full">请注意：为保证分析质量，建议输入不少于100字。此模式不支持断点续传。</p>
    </div>
  );
};
