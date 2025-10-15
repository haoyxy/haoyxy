import React, { useRef, useState } from 'react';

interface FileUploadAreaProps {
  onFileSelected: (file: File) => void;
  onTextSubmit: (text: string) => void;
  disabled?: boolean;
}

export const FileUploadArea: React.FC<FileUploadAreaProps> = React.memo(({ onFileSelected, onTextSubmit, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pastedText, setPastedText] = useState('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onFileSelected(event.target.files[0]);
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPastedText(event.target.value);
  };

  const handleSubmitText = () => {
    if (pastedText.trim()) {
      onTextSubmit(pastedText);
    }
  };

  return (
    <div className="w-full p-6 sm:p-8 bg-slate-900/50 rounded-xl shadow-2xl border border-cyan-500/10 flex flex-col items-center space-y-6">
      <div className="w-full">
        <h2 className="text-2xl font-semibold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent mb-5 text-center">上传您的小说文件</h2>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".txt,.doc,.docx,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
          className="hidden"
          disabled={disabled}
          aria-label="选择小说文件进行上传"
        />
        <button
          onClick={handleFileClick}
          disabled={disabled}
          className="w-full px-10 py-4 bg-gradient-to-br from-cyan-600 to-sky-700 hover:from-cyan-500 hover:to-sky-600 text-white font-bold rounded-lg shadow-lg hover:shadow-cyan-500/20 transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-md focus:outline-none focus:ring-4 focus:ring-cyan-300/50 text-lg"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 inline-block mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          选择文件
        </button>
        <p className="mt-4 text-sm text-center text-slate-500">支持格式：.txt, .doc, .docx。支持断点续传。</p>
      </div>

      <div className="flex items-center w-full">
        <div className="flex-grow border-t border-cyan-500/20"></div>
        <span className="flex-shrink mx-4 text-slate-400 font-semibold">或者</span>
        <div className="flex-grow border-t border-cyan-500/20"></div>
      </div>

      <div className="w-full">
        <h2 className="text-2xl font-semibold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent mb-5 text-center">直接粘贴文本内容</h2>
        <textarea
          value={pastedText}
          onChange={handleTextChange}
          disabled={disabled}
          placeholder="在此处粘贴您的小说文本... (粘贴文本不支持断点续传)"
          className="w-full h-48 p-4 bg-slate-900/70 border-2 border-slate-700 rounded-lg shadow-inner focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition-colors duration-200 resize-y disabled:bg-slate-800 text-slate-300 placeholder-slate-500"
          aria-label="粘贴小说文本"
        />
        <button
          onClick={handleSubmitText}
          disabled={disabled || !pastedText.trim()}
          className="mt-4 w-full px-10 py-4 bg-gradient-to-br from-teal-600 to-emerald-700 hover:from-teal-500 hover:to-emerald-600 text-white font-bold rounded-lg shadow-lg hover:shadow-emerald-500/20 transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-md focus:outline-none focus:ring-4 focus:ring-teal-300/50 text-lg"
        >
          分析粘贴的文本
        </button>
      </div>
    </div>
  );
});
