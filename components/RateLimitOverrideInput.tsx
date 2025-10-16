import React, { useState } from 'react';
import { Spinner } from './Spinner';

interface RateLimitOverrideInputProps {
  onApiKeySubmit: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
  currentError: string | null;
}

export const RateLimitOverrideInput: React.FC<RateLimitOverrideInputProps> = ({ onApiKeySubmit, currentError }) => {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || isLoading) return;

    setIsLoading(true);
    setValidationError(null);
    const result = await onApiKeySubmit(apiKey.trim());
    setIsLoading(false);

    if (!result.success) {
      setValidationError(result.error || "An unknown error occurred.");
    }
  };

  return (
    <div className="w-full p-5 bg-amber-900/40 border-2 border-amber-500/30 rounded-xl shadow-lg space-y-4">
        <div className="flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-amber-400 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
                <h3 className="text-xl font-semibold text-amber-300">已达到 API 使用限制</h3>
                {currentError && <p className="text-sm text-amber-300 mt-2">{currentError}</p>}
            </div>
        </div>

        <div className="pl-10 space-y-3">
             <p className="text-sm text-amber-400">
                这是正常现象，尤其是在处理长篇小说时。应用内置的 API Key 有免费的使用限额。
             </p>

            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div>
                     <label htmlFor="apiKeyOverride" className="block text-sm font-medium text-slate-200 mb-2">
                        想要立即继续？请输入您自己的 Gemini API Key：
                    </label>
                    <input
                      id="apiKeyOverride"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="粘贴您的 Google AI Studio API Key"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors text-slate-300 placeholder-slate-500"
                      disabled={isLoading}
                      aria-label="Override API Key Input"
                    />
                </div>
                <button
                  type="submit"
                  disabled={!apiKey.trim() || isLoading}
                  className="w-full flex justify-center items-center px-6 py-2.5 bg-gradient-to-r from-sky-600 to-cyan-600 text-white font-bold rounded-lg shadow-md hover:shadow-cyan-500/20 transition-all duration-200 disabled:opacity-60 disabled:cursor-wait"
                >
                  {isLoading ? <><Spinner size="sm" />&nbsp;正在验证并继续...</> : "使用新 Key 继续分析"}
                </button>
            </form>
            {validationError && (
                <div className="mt-2 p-3 bg-red-900/50 border border-red-500/30 rounded-lg text-red-300 text-sm">
                    {validationError}
                </div>
            )}
             <div className="pt-2 text-xs text-amber-500">
                <p>
                    如果您不提供自己的 Key，应用将在几分钟后使用默认 Key 自动重试。您的密钥仅保存在此浏览器中。
                </p>
                <p className="mt-1">
                    没有 API Key？
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:text-cyan-300 transition-colors mx-1">
                        点击此处免费获取
                    </a>
                </p>
            </div>
        </div>
    </div>
  );
};
