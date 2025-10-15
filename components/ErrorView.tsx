import React from 'react';
import { AppState } from '../types';
import { ErrorDisplay } from './ErrorDisplay';
import { BackButton } from './BackButton';
import { ChunkItem } from './ChunkItem';

interface ErrorViewProps {
  state: AppState;
  onReset: () => void;
  errorOverride?: string;
}

export const ErrorView: React.FC<ErrorViewProps> = ({ state, onReset, errorOverride }) => {
  return (
    <div className="space-y-6">
      <ErrorDisplay message={errorOverride ?? state.error} onClear={onReset} />
      {(state.analysisMode === null || (state.file === null && state.chunks.length === 0)) &&
        <div className="flex justify-center">
          <BackButton onClick={() => onReset()} text="返回选择模式" />
        </div>
      }
      {state.chunks.length > 0 && (
        <div className="mt-6 space-y-3 max-h-96 overflow-y-auto text-left">
          <h3 className="text-xl font-semibold text-slate-300 mb-4">当前分块状态：</h3>
          {state.chunks.sort((a, b) => a.order - b.order).map(chunk => (
            <ChunkItem key={chunk.id} chunk={chunk} />
          ))}
        </div>
      )}
    </div>
  );
};
