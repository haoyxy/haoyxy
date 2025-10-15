import React from 'react';

interface BackButtonProps {
  onClick: () => void;
  text?: string;
  title?: string; // For tooltip / aria-label
  className?: string; // For additional styling/positioning
}

export const BackButton: React.FC<BackButtonProps> = ({ onClick, text, title, className = "" }) => {
  const buttonTitle = title || (text ? `返回到 ${text.toLowerCase()}` : "返回上一步");
  return (
    <button
      onClick={onClick}
      title={buttonTitle}
      aria-label={buttonTitle}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-slate-300 bg-slate-700/50 hover:bg-slate-700/80 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75 transition-colors duration-150 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      disabled={false} // Assuming it's enabled by default, can be controlled from parent if needed
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      {text && <span className="font-medium">{text}</span>}
    </button>
  );
};
