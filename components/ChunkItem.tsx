import React, { useState } from 'react';
import { NovelChunk, ChunkStatus } from '../types';
import { Spinner } from './Spinner';
import { CopyToClipboardButton } from './CopyToClipboardButton';

const StatusIndicator: React.FC<{ status: ChunkStatus }> = React.memo(({ status }) => {
  switch (status) {
    case ChunkStatus.PENDING_READ:
      return <div className="flex items-center text-xs font-medium text-slate-400"><Spinner size="xs" color="text-slate-500" />&nbsp;等待读取</div>;
    case ChunkStatus.READING:
      return <div className="flex items-center text-xs font-medium text-sky-400"><Spinner size="xs" color="text-sky-400" />&nbsp;读取中...</div>;
    case ChunkStatus.PENDING_ANALYSIS:
      return <div className="flex items-center text-xs font-medium text-amber-400"><Spinner size="xs" color="text-amber-400" />&nbsp;等待分析</div>;
    case ChunkStatus.ANALYZING:
      return <div className="flex items-center text-xs font-medium text-cyan-400"><Spinner size="xs" color="text-cyan-400" />&nbsp;分析中...</div>;
    case ChunkStatus.ANALYZED:
      return <div className="flex items-center text-xs font-medium text-emerald-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        已分析
      </div>;
    case ChunkStatus.ERROR:
      return <div className="flex items-center text-xs font-medium text-red-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        错误
      </div>;
    default:
      return null;
  }
});

// FIX: Define props interface for ChunkItem component.
interface ChunkItemProps {
  chunk: NovelChunk;
}

export const ChunkItem: React.FC<ChunkItemProps> = React.memo(({ chunk }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-slate-900/50 rounded-xl shadow-lg hover:shadow-cyan-500/5 transition-shadow duration-300 overflow-hidden border border-cyan-500/10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={chunk.status !== ChunkStatus.ANALYZED && chunk.status !== ChunkStatus.ERROR}
        className="w-full p-4 text-left flex justify-between items-center hover:bg-slate-800/60 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-default disabled:hover:bg-transparent"
        aria-expanded={isOpen}
        aria-controls={`chunk-details-${chunk.id}`}
      >
        <span className="font-semibold text-cyan-400 text-lg">分块 {chunk.order + 1}</span>
        <div className="flex items-center space-x-3">
          <StatusIndicator status={chunk.status} />
          {(chunk.status === ChunkStatus.ANALYZED || chunk.status === ChunkStatus.ERROR) && (
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-slate-400 transform transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>
      {isOpen && (chunk.status === ChunkStatus.ANALYZED || chunk.status === ChunkStatus.ERROR) && (
        <div id={`chunk-details-${chunk.id}`} className="p-5 border-t border-cyan-500/10 bg-slate-900">
          {chunk.status === ChunkStatus.ERROR && chunk.error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-500/30 rounded-lg">
              <h4 className="font-semibold text-red-300 mb-1">错误详情：</h4>
              <p className="text-sm text-red-400 whitespace-pre-wrap">{chunk.error}</p>
            </div>
          )}
          {chunk.summary && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-cyan-300">分块摘要：</h4>
                <CopyToClipboardButton textToCopy={chunk.summary} displayText="复制摘要" />
              </div>
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{chunk.summary}</p>
            </div>
          )}
          {chunk.analysis && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-cyan-300">详细分析：</h4>
                <CopyToClipboardButton textToCopy={chunk.analysis} displayText="复制分析" />
              </div>
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{chunk.analysis}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});