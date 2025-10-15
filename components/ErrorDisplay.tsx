import React from 'react';

interface ErrorDisplayProps {
  message: string | null;
  onClear?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = React.memo(({ message, onClear }) => {
  if (!message) return null;

  return (
    <div className="w-full p-5 bg-red-900/40 border-2 border-red-500/30 rounded-xl shadow-lg text-center">
      <div className="flex items-center justify-center mb-3">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-xl font-semibold text-red-300">发生错误</h3>
      </div>
      <p className="text-md text-red-300 whitespace-pre-wrap">{message}</p>
      {onClear && (
        <button
          onClick={onClear}
          className="mt-5 px-5 py-2 bg-gradient-to-b from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 ease-in-out focus:outline-none focus:ring-4 focus:ring-red-300/50"
        >
          关闭并重置
        </button>
      )}
    </div>
  );
});
