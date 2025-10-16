import React from 'react';
import { AppState, AppOverallStatus, ChunkStatus } from '../types';
import { CHUNK_SIZE, INTER_CHUNK_API_DELAY_MS_OPENING, INTER_CHUNK_API_DELAY_MS_FULL } from '../constants';
import { BackButton } from './BackButton';
import { ProgressBar } from './ProgressBar';
import { StatusDisplay } from './StatusDisplay';
import { ErrorDisplay } from './ErrorDisplay';
import { ApiLimitWarning } from './ApiLimitWarning';
import { ChunkItem } from './ChunkItem';
import { RateLimitOverrideInput } from './RateLimitOverrideInput';
import { LiveEntityTracker } from './LiveEntityTracker';
import { ChunkMatrix } from './ChunkMatrix';

interface AnalysisInProgressProps {
  state: AppState;
  isProcessing: boolean;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  estimatedTimeRemaining: string | null;
  onCancel: () => void;
  onPause: () => void;
  onClearError: () => void;
  onApiKeyOverride: (newKey: string) => Promise<{ success: boolean; error?: string }>;
  workerLogs: string[];
}

export const AnalysisInProgress: React.FC<AnalysisInProgressProps> = ({
  state,
  isProcessing,
  progress,
  estimatedTimeRemaining,
  onCancel,
  onPause,
  onClearError,
  onApiKeyOverride,
  workerLogs,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <BackButton onClick={onCancel} text="取消并重置" title="取消当前分析并清除所有状态" />
        {isProcessing && state.appStatus !== AppOverallStatus.GENERATING_OPENING_ASSESSMENT && state.appStatus !== AppOverallStatus.GENERATING_FULL_NOVEL_REPORT && (
          <button
            onClick={onPause}
            disabled={state.appStatus === AppOverallStatus.PAUSED_RATE_LIMITED}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg shadow-md hover:shadow-amber-500/20 transition-all duration-200 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            暂停分析
          </button>
        )}
      </div>
      {state.fileName && <p className="text-xl font-semibold text-center text-slate-300">正在分析: <span className="font-bold text-cyan-400">{state.fileName}</span> ({state.analysisMode === 'opening' ? '开篇评估' : '全本精析'})</p>}
      
      {isProcessing && progress.total > 0 && (
        <div className="space-y-4 pt-2 main-card p-4 rounded-lg">
            <div className="flex justify-between items-center text-md text-slate-300 font-medium px-1">
                <span className="font-bold">总进度</span>
                {estimatedTimeRemaining && state.appStatus === AppOverallStatus.ANALYZING_CHUNKS && (
                  <span className="font-semibold text-cyan-400 animate-pulse">预计剩余: {estimatedTimeRemaining}</span>
                )}
            </div>
            <ProgressBar progress={progress.percentage} />
            <p className="text-center text-slate-400 text-2xl font-mono tracking-wider">{progress.current} / {progress.total}</p>
            <ChunkMatrix chunks={state.chunks} totalChunks={state.totalChunksToProcess} />
        </div>
      )}
      
      <StatusDisplay
        status={state.appStatus}
        currentChunk={state.currentProcessingChunkOrder + 1}
        totalChunks={state.totalChunksToProcess}
        analysisMode={state.analysisMode}
      />

      <LiveEntityTracker entities={state.allKnownEntities} />
      
      {state.error && state.appStatus !== AppOverallStatus.PAUSED_RATE_LIMITED && <ErrorDisplay message={state.error} onClear={onClearError} />}

      {state.appStatus === AppOverallStatus.PAUSED_RATE_LIMITED && (
        <RateLimitOverrideInput
          onApiKeySubmit={onApiKeyOverride}
          currentError={state.error}
        />
      )}
      
      {state.totalChunksToProcess > 0 && state.appStatus === AppOverallStatus.ANALYZING_CHUNKS && (
        <ApiLimitWarning
          totalChunks={state.totalChunksToProcess - state.currentProcessingChunkOrder}
          chunkSizeKB={CHUNK_SIZE / 1024}
          interChunkDelaySeconds={(state.analysisMode === "opening" ? INTER_CHUNK_API_DELAY_MS_OPENING : INTER_CHUNK_API_DELAY_MS_FULL) / 1000}
        />
      )}

      <div className="space-y-3">
        {state.chunks.filter(c => c.status === ChunkStatus.ANALYZED || c.status === ChunkStatus.ERROR || c.status === ChunkStatus.ANALYZING || c.status === ChunkStatus.READING).sort((a, b) => b.order - a.order).map(chunk => (
          <ChunkItem key={chunk.id} chunk={chunk} />
        ))}
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