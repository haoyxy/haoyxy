import React from 'react';
import { AppState, ChunkStatus } from '../types';
import { ErrorDisplay } from './ErrorDisplay';
import { ChunkItem } from './ChunkItem';

interface PausedScreenProps {
  state: AppState;
  isGeminiReady: boolean;
  onResume: () => void;
  onReset: () => void;
  onClearError: () => void;
}

export const PausedScreen: React.FC<PausedScreenProps> = ({ state, isGeminiReady, onResume, onReset, onClearError }) => {
  return (
    <div className="space-y-6 text-center p-6 bg-slate-900/50 rounded-xl shadow-2xl border border-cyan-500/10">
      <h2 className="text-3xl font-bold text-cyan-400">分析已暂停</h2>
      {state.fileName && <p className="text-lg text-slate-300">文件: <span className="font-semibold">{state.fileName}</span></p>}
      <p className="text-slate-400">
        已处理 {state.lastSuccessfullyProcessedChunkOrder + 1} / {state.totalChunksToProcess} 个分块。
      </p>
      <div className="flex justify-center space-x-4 mt-6">
        <button
          onClick={onResume}
          disabled={!isGeminiReady}
          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-md hover:shadow-emerald-500/20 transition-all duration-200 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          继续分析
        </button>
        <button
          onClick={onReset}
          className="px-8 py-3 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-colors"
        >
          放弃并重置
        </button>
      </div>
      {!isGeminiReady && <p className="mt-4 text-red-400 font-medium">AI 服务未初始化，无法继续分析。</p>}
      {state.error && <ErrorDisplay message={state.error} onClear={onClearError} />}
      <div className="mt-6 space-y-3 max-h-96 overflow-y-auto text-left">
        {state.chunks.filter(c => c.status === ChunkStatus.ANALYZED || c.status === ChunkStatus.ERROR || c.status === ChunkStatus.PENDING_ANALYSIS).sort((a, b) => b.order - a.order).map(chunk => (
          <ChunkItem key={chunk.id} chunk={chunk} />
        ))}
      </div>
    </div>
  );
};
