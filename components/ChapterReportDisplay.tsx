import React from 'react';
import { ChapterReport } from '../types';
import { CopyToClipboardButton } from './CopyToClipboardButton';
import { ExportButton } from './ExportButton';

const getRatingColor = (rating: 'High' | 'Medium' | 'Low'): string => {
  switch (rating) {
    case 'High': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case 'Medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    case 'Low': return 'bg-red-500/20 text-red-300 border-red-500/30';
    default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  }
};

const Gauge: React.FC<{ value: number; label: string }> = ({ value, label }) => {
  const percentage = Math.min(100, Math.max(0, value));
  const circumference = 2 * Math.PI * 45; // r=45
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  let colorClass = 'stroke-red-400';
  let textColorClass = 'text-red-400';
  if (percentage >= 75) {
    colorClass = 'stroke-emerald-400';
    textColorClass = 'text-emerald-400';
  } else if (percentage >= 40) {
    colorClass = 'stroke-yellow-400';
    textColorClass = 'text-yellow-400';
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 main-card rounded-xl h-full">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="transparent" stroke="#334155" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="transparent"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            className={`${colorClass} transition-all duration-1000 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-3xl font-bold ${textColorClass}`}>{percentage}%</span>
        </div>
      </div>
      <p className="mt-3 font-semibold text-slate-300 text-center">{label}</p>
    </div>
  );
};

const MetricCard: React.FC<{ value: string | number; label: string; rating?: 'High' | 'Medium' | 'Low' }> = ({ value, label, rating }) => (
  <div className={`flex flex-col items-center justify-center p-4 main-card rounded-xl h-full text-center ${rating ? getRatingColor(rating) : ''}`}>
    <p className={`text-5xl font-bold ${!rating && 'text-cyan-400'}`}>{value}</p>
    <p className={`mt-2 font-semibold ${rating ? 'text-inherit' : 'text-slate-300'}`}>{label}</p>
  </div>
);

const AnalysisSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="main-card p-4 rounded-lg">
        <h4 className="font-semibold text-cyan-300 mb-2">{title}</h4>
        <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {children}
        </div>
    </div>
);


export const ChapterReportDisplay: React.FC<{ report: ChapterReport }> = ({ report }) => {
  const { 
      effectivePlotProgressionRate, progressionAnalysis,
      informationDensityIndex, densityAnalysis,
      conflictClimaxDensity, conflictAnalysis,
      hookStrengthRating, hookAnalysis,
      overallAssessment 
  } = report;

  const fullReportText = `
章节质量量化评估报告

--- 综合评估 ---
${overallAssessment}

--- 详细指标 ---

1. 有效剧情推进率: ${effectivePlotProgressionRate}%
   分析: ${progressionAnalysis}

2. 信息密度指数: ${informationDensityIndex}/10
   分析: ${densityAnalysis}

3. 冲突/爽点密度: ${conflictClimaxDensity}
   分析: ${conflictAnalysis}

4. “钩子”强度评级: ${hookStrengthRating}
   分析: ${hookAnalysis}
  `;

  return (
    <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <h2 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-sky-500 bg-clip-text text-transparent">
              章节质量评估报告
            </h2>
            <div className="flex space-x-3 mt-4 sm:mt-0">
                <CopyToClipboardButton textToCopy={fullReportText} displayText="复制完整报告" />
                <ExportButton 
                    contentToExport={fullReportText} 
                    defaultFilename="chapter_quality_report.txt"
                    buttonText="导出报告"
                />
            </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
                <Gauge value={effectivePlotProgressionRate} label="有效剧情推进率" />
                <AnalysisSection title="推进率分析">{progressionAnalysis}</AnalysisSection>
            </div>
            <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <MetricCard value={informationDensityIndex} label="信息密度 (1-10分)" />
                    <MetricCard value={conflictClimaxDensity} label="冲突/爽点密度" />
                </div>
                <MetricCard value={hookStrengthRating} label="结尾“钩子”强度" rating={hookStrengthRating} />
            </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <AnalysisSection title="信息密度分析">{densityAnalysis}</AnalysisSection>
             <AnalysisSection title="冲突/爽点分析">{conflictAnalysis}</AnalysisSection>
             <AnalysisSection title="结尾“钩子”分析">{hookAnalysis}</AnalysisSection>
        </div>

        <div className="main-card rounded-xl p-6">
            <div className="flex items-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-cyan-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-2xl font-bold text-slate-100">综合评估与建议</h3>
            </div>
            <div className="pl-10 prose prose-custom max-w-none prose-lg whitespace-pre-wrap leading-relaxed text-slate-300">
                {overallAssessment}
            </div>
        </div>
    </div>
  );
};