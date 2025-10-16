import React from 'react';
import { AppState, AppOverallStatus, ChunkStatus } from '../types';
import { BackButton } from './BackButton';
import { OverallAnalysisDisplay } from './OverallAnalysisDisplay';
import { ChunkItem } from './ChunkItem';
import { ExtractedEntity } from '../types';

const EntityListDisplay: React.FC<{ entities: Map<string, ExtractedEntity> }> = ({ entities }) => {
  if (entities.size === 0) {
    return null;
  }
  const sortedEntities = Array.from(entities.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
  
  return (
    <details className="pt-6 border-t border-cyan-500/10 group">
      <summary className="text-2xl font-semibold text-slate-200 mb-4 list-none cursor-pointer flex items-center justify-between hover:text-cyan-400 transition-colors">
        <span>关键实体列表 ({sortedEntities.length})</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transform group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="mt-4 bg-slate-900/50 rounded-lg p-4 border border-slate-700/50 max-h-96 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedEntities.map(entity => (
            <div key={entity.name} className="bg-slate-800/70 p-4 rounded-lg shadow">
              <div className="flex justify-between items-start">
                  <h4 className="text-lg font-bold text-cyan-400">{entity.name}</h4>
                  <span className="text-xs font-semibold text-teal-300 bg-teal-800/50 px-2 py-1 rounded-full">{entity.type}</span>
              </div>
              <p className="text-sm text-slate-400 mt-2">{entity.context}</p>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
};


interface AnalysisCompletedProps {
  state: AppState;
  onReset: () => void;
}

export const AnalysisCompleted: React.FC<AnalysisCompletedProps> = ({ state, onReset }) => {
  const isOpeningAnalysis = state.appStatus === AppOverallStatus.OPENING_ANALYSIS_COMPLETED;
  const analysis = isOpeningAnalysis ? state.openingAssessment : state.fullNovelReport;
  const title = isOpeningAnalysis ? "小说开篇评估报告" : "小说全本分析报告";
  const fileNameForExport = isOpeningAnalysis ? `${state.fileName}_开篇评估` : `${state.fileName}_全本报告`;

  return (
    <div className="space-y-8">
      <BackButton onClick={onReset} text="分析新小说" />
      <OverallAnalysisDisplay
        markdownContent={analysis}
        title={title}
        fileNameForExport={fileNameForExport}
      />

      <EntityListDisplay entities={state.allKnownEntities} />

      <details className="pt-6 border-t border-cyan-500/10 group">
        <summary className="text-2xl font-semibold text-slate-200 mb-4 list-none cursor-pointer flex items-center justify-between hover:text-cyan-400 transition-colors">
          <span>分块详情</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transform group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="space-y-3 mt-4">
            {state.chunks.filter(c => c.status === ChunkStatus.ANALYZED || c.status === ChunkStatus.ERROR).sort((a, b) => a.order - b.order).map(chunk => (
            <ChunkItem key={chunk.id} chunk={chunk} />
            ))}
        </div>
      </details>
    </div>
  );
};