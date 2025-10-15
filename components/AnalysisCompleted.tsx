import React from 'react';
import { AppState, AppOverallStatus, ChunkStatus } from '../types';
import { BackButton } from './BackButton';
import { OverallAnalysisDisplay } from './OverallAnalysisDisplay';
import { ChunkItem } from './ChunkItem';

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
        analysis={analysis}
        title={title}
        fileNameForExport={fileNameForExport}
      />
      <div className="pt-6 border-t border-cyan-500/10">
        <h3 className="text-2xl font-semibold text-slate-200 mb-4">分块详情：</h3>
        <div className="space-y-3">
            {state.chunks.filter(c => c.status === ChunkStatus.ANALYZED || c.status === ChunkStatus.ERROR).sort((a, b) => a.order - b.order).map(chunk => (
            <ChunkItem key={chunk.id} chunk={chunk} />
            ))}
        </div>
      </div>
    </div>
  );
};
