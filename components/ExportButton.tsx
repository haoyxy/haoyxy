import React from 'react';

interface ExportButtonProps {
  contentToExport: string;
  defaultFilename: string;
  buttonText?: string;
  className?: string;
  disabled?: boolean;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  contentToExport,
  defaultFilename,
  buttonText = "导出文件",
  className = "",
  disabled = false,
}) => {
  const handleExport = () => {
    if (disabled || !contentToExport) return;

    const blob = new Blob([contentToExport], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      disabled={disabled || !contentToExport}
      title={buttonText}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-white bg-gradient-to-br from-cyan-600 to-sky-700 hover:from-cyan-500 hover:to-sky-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75 transition-all duration-150 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      <span>{buttonText}</span>
    </button>
  );
};
