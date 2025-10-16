import React from 'react';
import { CopyToClipboardButton } from './CopyToClipboardButton';
import { ExportButton } from './ExportButton'; 
import { MarkdownRenderer } from './MarkdownRenderer';

interface OverallAnalysisDisplayProps {
  markdownContent: string | null;
  title: string; 
  fileNameForExport?: string;
}

export const OverallAnalysisDisplay: React.FC<OverallAnalysisDisplayProps> = React.memo(({ markdownContent, title, fileNameForExport }) => {
  if (!markdownContent) return null;

  const defaultExportFilename = fileNameForExport || `${title.replace(/\s+/g, '_')}_report.txt`;

  return (
    <div className="main-card p-6 sm:p-8 rounded-xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b-2 border-slate-700/50 pb-4">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-sky-500 bg-clip-text text-transparent">
          {title} 
        </h2>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <CopyToClipboardButton textToCopy={markdownContent} displayText="复制报告" />
          <ExportButton 
            contentToExport={markdownContent} 
            defaultFilename={defaultExportFilename}
            buttonText="导出报告"
          />
        </div>
      </div>
      <MarkdownRenderer markdownContent={markdownContent} />
    </div>
  );
});