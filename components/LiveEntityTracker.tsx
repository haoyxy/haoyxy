import React, { useMemo } from 'react';
import { ExtractedEntity } from '../types';

interface LiveEntityTrackerProps {
  entities: Map<string, ExtractedEntity>;
}

export const LiveEntityTracker: React.FC<LiveEntityTrackerProps> = ({ entities }) => {
  const sortedEntities = useMemo(() => {
    if (entities.size === 0) return [];
    return Array.from(entities.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
  }, [entities]);

  if (sortedEntities.length === 0) {
    return null;
  }

  return (
    <details className="main-card rounded-xl p-4 group" open>
      <summary className="text-xl font-semibold text-slate-200 list-none cursor-pointer flex items-center justify-between hover:text-cyan-400 transition-colors">
        <div className="flex items-center space-x-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span>实时实体追踪器 ({sortedEntities.length})</span>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transform group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="mt-4 bg-slate-900/50 rounded-lg p-4 border border-slate-700/50 max-h-72 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedEntities.map(entity => (
            <div key={entity.name} className="bg-slate-800/70 p-3 rounded-lg shadow-sm animate-fadeInUp" style={{animation: 'fadeInUp 0.5s ease-out forwards'}}>
              <div className="flex justify-between items-start">
                  <h4 className="text-md font-bold text-cyan-400">{entity.name}</h4>
                  <span className="text-xs font-semibold text-teal-300 bg-teal-800/50 px-2 py-1 rounded-full whitespace-nowrap">{entity.type}</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">{entity.context}</p>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
};