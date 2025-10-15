import React from 'react';
import { AppOverallStatus, AnalysisMode } from '../types';
import { Spinner } from './Spinner';

interface StatusDisplayProps {
  status: AppOverallStatus;
  currentChunk?: number;
  totalChunks?: number;
  analysisMode?: AnalysisMode | null;
}

export const StatusDisplay: React.FC<StatusDisplayProps> = React.memo(({ status, currentChunk, totalChunks, analysisMode }) => {
  let message = '';
  const modeText = analysisMode === 'opening' ? '开篇' : (analysisMode === 'full' ? '全本' : '');

  switch (status) {
    case AppOverallStatus.READING_CHUNKS:
      message = `正在准备分析，请稍候 (读取与分块)...`;
      break;
    case AppOverallStatus.ANALYZING_CHUNKS:
      if (currentChunk && totalChunks && currentChunk > totalChunks) {
          message = '所有分块分析完成，准备生成最终报告...';
      } else {
          message = `正在进行AI分析... (分块 ${currentChunk} / ${totalChunks})`;
      }
      break;
    case AppOverallStatus.GENERATING_OPENING_ASSESSMENT:
      message = '所有分块分析完成，正在生成最终的开篇评估报告... (预计需要 1-2 分钟，请勿关闭页面)';
      break;
    case AppOverallStatus.GENERATING_FULL_NOVEL_REPORT:
      message = '所有分块分析完成，正在生成最终的全本分析报告... (这可能需要 2-5 分钟，请勿关闭页面)';
      break;
    default:
      return null;
  }

  return (
    <div className="w-full p-4 bg-slate-900/50 rounded-xl shadow-lg flex items-center justify-center space-x-3 border border-cyan-500/10">
      <Spinner size="sm" color="text-cyan-400" />
      <p className="text-md text-cyan-300 font-medium">{message}</p>
    </div>
  );
});
