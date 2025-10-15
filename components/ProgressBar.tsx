import React from 'react';

interface ProgressBarProps {
  progress: number; // 0 to 100
}

export const ProgressBar: React.FC<ProgressBarProps> = React.memo(({ progress }) => {
  const safeProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className="w-full bg-slate-700/50 rounded-full h-5 shadow-inner overflow-hidden border border-cyan-500/10">
      <div
        className="bg-gradient-to-r from-cyan-500 to-teal-500 h-full rounded-full transition-all duration-300 ease-out flex items-center justify-center progress-bar-striped progress-bar-glow"
        style={{ width: `${safeProgress}%` }}
        role="progressbar"
        aria-valuenow={safeProgress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
         {safeProgress > 15 && <span className="text-xs font-bold text-slate-900 shadow-sm">{Math.round(safeProgress)}%</span>}
      </div>
    </div>
  );
});
