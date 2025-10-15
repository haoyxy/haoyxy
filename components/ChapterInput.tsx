import React, { useState } from 'react';

interface ChapterInputProps {
  onChapterSubmit: (chapterText: string) => void;
  disabled?: boolean;
}

export const ChapterInput: React.FC<ChapterInputProps> = ({ onChapterSubmit, disabled }) => {
  const [chapterText, setChapterText] = useState('');
  const wordCount = chapterText.trim() === '' ? 0 : chapterText.trim().split('').length;

  const handleSubmit = () => {
    if (chapterText.trim()) {
      onChapterSubmit(chapterText);
    }
  };

  return (
    <div className="main-card w-full p-6 sm:p-8 rounded-xl flex flex-col items-center space-y-6">
      <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent text-center">输入章节内容</h2>
      <p className="text-slate-400 text-center max-w-2xl">
        请在此处粘贴您想要评估的单章节文本。为获得最佳分析效果，推荐字数在 2000 - 5000 字之间。
      </p>
      <textarea
        value={chapterText}
        onChange={(e) => setChapterText(e.target.value)}
        disabled={disabled}
        placeholder="在此处粘贴您的章节内容..."
        className="w-full h-96 p-4 bg-slate-900 border-2 border-slate-700 rounded-lg shadow-inner focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-200 resize-y disabled:bg-slate-800 text-slate-300 placeholder-slate-500"
        aria-label="章节内容输入框"
      />
       <div className="w-full flex justify-between items-center flex-wrap gap-4">
        <p className={`text-sm font-medium transition-colors ${wordCount < 1500 || wordCount > 6000 ? 'text-amber-400' : 'text-slate-500'}`}>
            当前字数: {wordCount} (推荐 2000-5000)
        </p>
        <button
          onClick={handleSubmit}
          disabled={disabled || !chapterText.trim() || wordCount < 500}
          className="px-10 py-4 bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-500 text-white font-bold rounded-lg shadow-lg hover:shadow-cyan-500/30 transform hover:-translate-y-1 active:translate-y-0 transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-md focus:outline-none focus:ring-4 focus:ring-cyan-400/50 text-lg btn-animated-gradient"
        >
          开始量化评估
        </button>
      </div>
       <p className="text-xs text-slate-600 text-center w-full">请注意：为保证分析质量，建议输入不少于500字。此模式不支持断点续传。</p>
    </div>
  );
};