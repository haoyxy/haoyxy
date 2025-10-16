import React from 'react';
import { Spinner } from './Spinner';
import { ProgressBar } from './ProgressBar';

interface PreparingAnalysisViewProps {
  fileName: string | null;
  progress: number | null;
}

export const PreparingAnalysisView: React.FC<PreparingAnalysisViewProps> = ({ fileName, progress }) => {
  const displayProgress = progress ?? 0;

  return (
    <div className="text-center p-6 flex flex-col items-center justify-center space-y-6 main-card rounded-lg">
        {fileName && <p className="text-xl font-semibold text-center text-slate-300">正在处理文件: <span className="font-bold text-cyan-400">{fileName}</span></p>}
        <div className="w-full max-w-md space-y-3">
             <div className="flex justify-between items-center text-md text-slate-300 font-medium px-1">
                <div className="flex items-center space-x-2">
                    <Spinner size="sm" />
                    <span className="font-bold">正在智能分块...</span>
                </div>
                <span className="font-semibold text-cyan-400">{displayProgress}%</span>
            </div>
            <ProgressBar progress={displayProgress} />
        </div>
        <p className="text-slate-500 text-sm max-w-md">
            对于较大的文件，此过程可能需要一些时间。应用正在后台读取文件、解码文本并将其分割成适合 AI 分析的小块。
        </p>
    </div>
  );
};
