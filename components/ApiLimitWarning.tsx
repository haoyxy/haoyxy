import React from 'react';

interface ApiLimitWarningProps {
  totalChunks: number;
  chunkSizeKB: number;
  interChunkDelaySeconds: number;
}

export const ApiLimitWarning: React.FC<ApiLimitWarningProps> = React.memo(({ totalChunks, chunkSizeKB, interChunkDelaySeconds }) => {
  if (totalChunks === 0) return null;

  const estimatedMinTimeMinutes = Math.ceil((totalChunks * interChunkDelaySeconds) / 60);
  const totalSizeMB = (totalChunks * chunkSizeKB) / 1024;

  return (
    <div className="w-full p-5 bg-amber-900/40 border-2 border-amber-500/30 rounded-xl shadow-lg mb-6">
      <div className="flex items-start">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-amber-400 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <h3 className="text-xl font-semibold text-amber-300 mb-2">请注意：API 使用限制与处理时间</h3>
          <p className="text-sm text-amber-300 mb-2">
            您准备分析 <strong className="font-semibold text-amber-200">{totalChunks}</strong> 个文本分块 (总计约 <strong className="font-semibold text-amber-200">{totalSizeMB.toFixed(1)}MB</strong>)。
            本应用通过 Gemini API 对每个分块进行分析，API 调用之间设置了约 <strong className="font-semibold text-amber-200">{interChunkDelaySeconds}</strong> 秒的延迟，以帮助管理 API 的使用限制。
          </p>
          <p className="text-sm text-amber-300 mb-2">
            预计最短处理时间约为 <strong className="font-semibold text-amber-200">{estimatedMinTimeMinutes}</strong> 分钟（不包括 AI 实际分析时间和潜在的 API 重试延迟）。
            对于非常长的文本，总时间可能更长。
          </p>
          <ul className="list-disc list-inside text-sm text-amber-400 space-y-1 mb-2">
            <li>
              Gemini API 对请求频率（RPM）、每分钟处理的令牌数（TPM）和每日总请求数（RPD）有限制，尤其是在免费或较低的使用层级。
            </li>
            <li>
              处理大量分块可能会达到这些限制，导致分析速度变慢（由于自动重试）或在达到每日上限后失败。
            </li>
            <li>
              我们已尽力通过延迟和重试机制来管理这些限制，但结果仍取决于您 API 密钥的当前配额和层级。
            </li>
             <li>
              <strong className="font-semibold text-amber-200">重要：</strong>本应用会尝试在分析过程中保存您的进度。如果分析因故中断（如达到API每日限额），您可以稍后重新选择相同的文件和模式以尝试继续分析。
            </li>
          </ul>
          <p className="text-xs text-amber-500">
            建议：对于非常大的文件，请确保您的 API 密钥有足够的配额，或考虑分批处理。您可以查阅 Google AI Studio 了解您账户的 API 限制详情。
          </p>
        </div>
      </div>
    </div>
  );
});
