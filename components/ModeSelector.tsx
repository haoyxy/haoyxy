import React from 'react';
import { AnalysisMode } from '../types';

interface ModeSelectorProps {
  onModeSelect: (mode: AnalysisMode) => void;
  workerLogs: string[];
}

const ModeCard: React.FC<{
  mode: AnalysisMode;
  title: string;
  description: string;
  // FIX: Use React.ReactElement instead of JSX.Element to resolve namespace issue.
  icon: React.ReactElement;
  onClick: (mode: AnalysisMode) => void;
  className?: string;
}> = ({ mode, title, description, icon, onClick, className }) => (
  <div
    className={`bg-slate-900/50 p-8 rounded-xl border border-cyan-500/20 shadow-lg hover:shadow-cyan-500/10 hover:border-cyan-500/50 transition-all duration-300 flex flex-col items-center text-center cursor-pointer group ${className}`}
    onClick={() => onClick(mode)}
  >
    <div className="mb-6 text-cyan-400 group-hover:text-cyan-300 transition-colors duration-300">
      {icon}
    </div>
    <h3 className="text-2xl font-bold text-slate-100 mb-3">{title}</h3>
    <p className="text-slate-400 mb-6 flex-grow">{description}</p>
    <button className="mt-auto w-full px-8 py-3 bg-cyan-600/80 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg hover:shadow-cyan-500/20 transform group-hover:-translate-y-1 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-cyan-300/50 text-lg">
      选择此模式
    </button>
  </div>
);


export const ModeSelector: React.FC<ModeSelectorProps> = ({ onModeSelect, workerLogs }) => {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-sky-500 mb-2">选择分析模式</h2>
        <p className="text-slate-400">您希望如何分析这本小说？</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <ModeCard
            mode="opening"
            title="📖 开篇评估 (快速)"
            description="依据“黄金三章”理论，快速分析小说前几万字，评估其市场潜力、节奏和吸引力。适合作者自查或编辑快速筛选。"
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v11.494m-9-5.747h18" /></svg>}
            onClick={onModeSelect}
        />
        <ModeCard
            mode="full"
            title="📚 全本精析 (深入)"
            description="对整部小说进行全面、细致的解构，分析其剧情结构、角色弧光、主题深度和文笔风格。适合读者深度复盘或进行学术研究。"
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>}
            onClick={onModeSelect}
        />
      </div>
       {workerLogs.length > 0 && (
        <div className="mt-4 p-4 bg-slate-900/70 rounded-lg shadow-inner border border-cyan-500/10 max-h-60 overflow-y-auto">
          <h4 className="font-semibold text-slate-300 mb-2">文件处理日志：</h4>
          <pre className="text-xs text-slate-400 space-y-1 whitespace-pre-wrap font-mono">
            {workerLogs.map((log, index) => <div key={index}>{log}</div>)}
          </pre>
        </div>
      )}
    </div>
  );
};