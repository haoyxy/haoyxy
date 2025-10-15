import React from 'react';
import { ViabilityReport } from '../types';
import { CopyToClipboardButton } from './CopyToClipboardButton';
import { ExportButton } from './ExportButton';

const getScoreColor = (score: number): string => {
  if (score >= 8) return 'text-emerald-400';
  if (score >= 5) return 'text-yellow-400';
  return 'text-red-400';
};

const getSeverityClasses = (severity: 'High' | 'Medium' | 'Low'): string => {
  switch (severity) {
    case 'High':
      return 'bg-red-900/50 border-red-500/30 text-red-300';
    case 'Medium':
      return 'bg-amber-900/50 border-amber-500/30 text-amber-300';
    case 'Low':
      return 'bg-sky-900/50 border-sky-500/30 text-sky-300';
    default:
      return 'bg-slate-700/50 border-slate-500/30 text-slate-300';
  }
};

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-slate-900/50 rounded-xl shadow-lg border border-cyan-500/10 p-6">
    <div className="flex items-center mb-4">
      <div className="text-cyan-400 mr-3">{icon}</div>
      <h3 className="text-2xl font-bold text-slate-100">{title}</h3>
    </div>
    <div className="pl-9">{children}</div>
  </div>
);

export const ViabilityReportDisplay: React.FC<{ report: ViabilityReport }> = ({ report }) => {
  const { noveltyScore, noveltyAnalysis, marketFitAnalysis, poisonPillWarning, overallAssessment } = report;

  return (
    <div className="space-y-8">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-sky-500 bg-clip-text text-transparent text-center">
          创意可行性分析报告
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-slate-300">
            <div className="md:col-span-1 bg-slate-900/50 rounded-xl shadow-lg border border-cyan-500/10 p-6 flex flex-col items-center justify-center text-center">
                <h4 className="text-lg font-semibold text-slate-200 mb-2">新颖度评分</h4>
                <p className={`text-7xl font-extrabold ${getScoreColor(noveltyScore)}`}>{noveltyScore}<span className="text-4xl text-slate-500">/10</span></p>
            </div>
            <div className="md:col-span-2 bg-slate-900/50 rounded-xl shadow-lg border border-cyan-500/10 p-6">
                 <h4 className="text-lg font-semibold text-slate-200 mb-2">评分解析</h4>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{noveltyAnalysis}</p>
            </div>
        </div>

        <Section title="市场匹配度分析" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}>
            <div className="space-y-4 text-slate-300">
                <div>
                    <h4 className="font-semibold text-cyan-300 mb-1">推荐题材分类:</h4>
                    <div className="flex flex-wrap gap-2">
                        {marketFitAnalysis.recommendedGenres.map(genre => (
                            <span key={genre} className="px-3 py-1 bg-cyan-800/50 text-cyan-200 text-sm font-medium rounded-full">{genre}</span>
                        ))}
                    </div>
                </div>
                <div>
                    <h4 className="font-semibold text-cyan-300 mb-1">目标读者画像:</h4>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{marketFitAnalysis.targetAudience}</p>
                </div>
                <div>
                    <h4 className="font-semibold text-cyan-300 mb-1">市场潜力预测:</h4>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{marketFitAnalysis.marketPotential}</p>
                </div>
            </div>
        </Section>

        <Section title="潜在毒点预警" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}>
            <div className="space-y-4">
                {poisonPillWarning.warnings.length > 0 ? (
                    poisonPillWarning.warnings.map((warning, index) => (
                        <div key={index} className={`p-4 rounded-lg border ${getSeverityClasses(warning.severity)}`}>
                            <div className="flex justify-between items-center mb-1">
                                <h4 className="font-bold">{warning.type}</h4>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full border">{warning.severity} Risk</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{warning.description}</p>
                        </div>
                    ))
                ) : (
                    <p className="text-emerald-400">未检测到明显的常见毒点，设定较为安全。</p>
                )}
                 <div className="pt-4 border-t border-cyan-500/10">
                    <h4 className="font-semibold text-cyan-300 mb-1">风险总结:</h4>
                    <p className="text-sm text-slate-400 whitespace-pre-wrap">{poisonPillWarning.summary}</p>
                </div>
            </div>
        </Section>

         <Section title="综合评估与建议" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}>
             <div className="prose prose-custom max-w-none prose-lg whitespace-pre-wrap leading-relaxed text-slate-300">
                {overallAssessment}
            </div>
            <div className="flex space-x-3 mt-6">
                <CopyToClipboardButton textToCopy={overallAssessment} displayText="复制评估" />
                <ExportButton 
                    contentToExport={`创意可行性分析报告\n\n${overallAssessment}`} 
                    defaultFilename="creative_viability_report.txt"
                    buttonText="导出评估"
                />
            </div>
        </Section>
    </div>
  );
};
