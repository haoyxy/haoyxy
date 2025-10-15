import React, { useState, useEffect } from 'react';

interface CopyToClipboardButtonProps {
  textToCopy: string;
  displayText?: string;
  className?: string;
  disabled?: boolean;
}

export const CopyToClipboardButton: React.FC<CopyToClipboardButtonProps> = ({
  textToCopy,
  displayText = "复制",
  className = "",
  disabled = false,
}) => {
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => {
        setIsCopied(false);
      }, 2000); // Reset after 2 seconds
      return () => clearTimeout(timer);
    }
  }, [isCopied]);

  const handleCopy = async () => {
    if (disabled || !textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      disabled={disabled || !textToCopy || isCopied}
      title={isCopied ? "已复制!" : displayText}
      className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ease-in-out shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
        isCopied
          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
          : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
      } ${className}`}
    >
      {isCopied ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
      <span>{isCopied ? "已复制!" : displayText}</span>
    </button>
  );
};
