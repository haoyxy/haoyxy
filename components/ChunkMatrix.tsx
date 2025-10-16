import React, { useMemo } from 'react';
import { NovelChunk, ChunkStatus } from '../types';

interface ChunkMatrixProps {
  chunks: NovelChunk[];
  totalChunks: number;
}

const getStatusClasses = (status?: ChunkStatus): string => {
  switch (status) {
    case ChunkStatus.ANALYZED:
      return 'bg-emerald-500/80';
    case ChunkStatus.ANALYZING:
      return 'bg-cyan-500/90 animate-pulse';
    case ChunkStatus.READING:
       return 'bg-sky-600/70 animate-pulse';
    case ChunkStatus.ERROR:
      return 'bg-red-600/90';
    case ChunkStatus.PENDING_ANALYSIS:
    case ChunkStatus.PENDING_READ:
    default:
      return 'bg-slate-700/60';
  }
};

const getStatusTitle = (status?: ChunkStatus): string => {
    switch (status) {
        case ChunkStatus.ANALYZED: return '已分析';
        case ChunkStatus.ANALYZING: return '分析中';
        case ChunkStatus.READING: return '读取中';
        case ChunkStatus.ERROR: return '错误';
        case ChunkStatus.PENDING_ANALYSIS: return '等待分析';
        case ChunkStatus.PENDING_READ: return '等待读取';
        default: return '待处理';
    }
}

export const ChunkMatrix: React.FC<ChunkMatrixProps> = ({ chunks, totalChunks }) => {
  const chunkMap = useMemo(() => new Map(chunks.map(chunk => [chunk.order, chunk])), [chunks]);

  if (totalChunks <= 1) {
    return null;
  }
  
  if (totalChunks > 1000) {
      return (
          <div className="text-center text-xs text-slate-500 pt-2">
              共 {totalChunks} 个分块，因数量过多，矩阵视图已简化。
          </div>
      )
  }

  return (
    <details className="pt-4 group">
        <summary className="text-sm font-semibold text-slate-400 list-none cursor-pointer flex items-center justify-between hover:text-cyan-400 transition-colors">
            <span>分块矩阵视图</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </summary>
        <div className="mt-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
            <div className="chunk-matrix-grid">
            {Array.from({ length: totalChunks }, (_, i) => {
                const chunk = chunkMap.get(i);
                const status = chunk?.status;
                const error = chunk?.error;
                const title = `分块 ${i + 1} / ${totalChunks}\n状态: ${getStatusTitle(status)}${error ? `\n错误: ${error}` : ''}`;
                
                return (
                    <div
                        key={i}
                        className={`chunk-matrix-cell ${getStatusClasses(status)}`}
                        title={title}
                    />
                );
            })}
            </div>
        </div>
    </details>
  );
};