
import React, { useState, useEffect, useMemo } from 'react';
import { useAppState } from './hooks/useAppState';
import { AppOverallStatus } from './types';
import { APP_NAME } from './constants';

import { GoogleGenAI } from '@google/genai';
import { ModeSelector } from './components/ModeSelector';
import { FileUploadArea } from './components/FileUploadArea';
import { AnalysisInProgress } from './components/AnalysisInProgress';
import { PausedScreen } from './components/PausedScreen';
import { AnalysisCompleted } from './components/AnalysisCompleted';
import { ErrorView } from './components/ErrorView';
import { CancelledScreen } from './components/CancelledScreen';
import { Spinner } from './components/Spinner';
import { BackButton } from './components/BackButton';
import { PreparingAnalysisView } from './components/PreparingAnalysisView';


const APP_PERSISTENCE_VERSION = "1.0.1";

const App: React.FC = () => {
  const [initializationError, setInitializationError] = useState<string | null>(null);

  const geminiAi = useMemo(() => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      setInitializationError("应用配置错误：AI 服务的 API Key 未设置。应用暂时无法使用。");
      return null;
    }
    try {
      return new GoogleGenAI({ apiKey });
    } catch (error: any) {
      console.error("Failed to initialize GoogleGenAI client:", error);
      setInitializationError(`AI 服务初始化失败：${error.message}`);
      return null;
    }
  }, []);

  const {
    state,
    workerLogs,
    estimatedTimeRemaining,
    handleModeSelect,
    handleFileSelected,
    handleTextSubmit,
    handlePause,
    handleResume,
    handleCancel,
    handleReset,
    clearError,
    handleApiKeyOverride,
  } = useAppState(geminiAi);

  const renderContent = () => {
    if (initializationError) {
        return <ErrorView state={state} onReset={() => window.location.reload()} errorOverride={initializationError} />;
    }
      
    if (!geminiAi) {
      return (
            <div className="text-center p-6 flex flex-col items-center justify-center space-y-4">
                <Spinner size="lg" />
                <p className="text-slate-400">正在初始化 AI 服务...</p>
            </div>
        );
    }
                      
    const isProcessing = state.appStatus === AppOverallStatus.READING_CHUNKS ||
                         state.appStatus === AppOverallStatus.ANALYZING_CHUNKS ||
                         state.appStatus === AppOverallStatus.GENERATING_OPENING_ASSESSMENT ||
                         state.appStatus === AppOverallStatus.GENERATING_FULL_NOVEL_REPORT;
                         
    const isPreparing = state.appStatus === AppOverallStatus.PREPARING_ANALYSIS;

    const totalSteps = state.totalChunksToProcess > 0 ? state.totalChunksToProcess + 1 : 0; // +1 for the final report
    let currentStep = state.currentProcessingChunkOrder;
    if (state.appStatus === AppOverallStatus.GENERATING_OPENING_ASSESSMENT || state.appStatus === AppOverallStatus.GENERATING_FULL_NOVEL_REPORT) {
      currentStep = state.totalChunksToProcess;
    } else if (state.appStatus === AppOverallStatus.OPENING_ANALYSIS_COMPLETED || state.appStatus === AppOverallStatus.FULL_NOVEL_ANALYSIS_COMPLETED) {
      currentStep = totalSteps;
    }
    const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

    switch (state.appStatus) {
      case AppOverallStatus.IDLE:
        return <ModeSelector onModeSelect={handleModeSelect} workerLogs={workerLogs} />;

      case AppOverallStatus.MODE_SELECTED:
        return (
            <div className="space-y-6">
                <BackButton onClick={() => handleReset(false)} text="返回选择模式" />
                <FileUploadArea
                    onFileSelected={handleFileSelected}
                    onTextSubmit={handleTextSubmit}
                    disabled={!geminiAi}
                />
            </div>
        );
        
      case AppOverallStatus.PREPARING_ANALYSIS:
        return (
            <div className="space-y-6">
                 <BackButton onClick={() => handleReset(false)} text="取消准备" />
                 <PreparingAnalysisView 
                    fileName={state.fileName} 
                    progress={state.chunkingProgress} 
                 />
            </div>
        );
      
      case AppOverallStatus.FILE_SELECTED:
      case AppOverallStatus.READING_CHUNKS:
      case AppOverallStatus.ANALYZING_CHUNKS:
      case AppOverallStatus.GENERATING_OPENING_ASSESSMENT:
      case AppOverallStatus.GENERATING_FULL_NOVEL_REPORT:
      case AppOverallStatus.PAUSED_RATE_LIMITED:
        return (
          <AnalysisInProgress
            state={state}
            isProcessing={isProcessing}
            progress={{ current: currentStep, total: totalSteps, percentage: progress }}
            estimatedTimeRemaining={estimatedTimeRemaining}
            onCancel={handleCancel}
            onPause={handlePause}
            onClearError={clearError}
            onApiKeyOverride={handleApiKeyOverride}
            workerLogs={workerLogs}
          />
        );

// FIX: Corrected typo in enum member name for the paused status.
      case AppOverallStatus.PAUSED_AWAITING_RESUME:
        return (
          <PausedScreen 
            state={state}
            isGeminiReady={!!geminiAi}
            onResume={handleResume}
            onReset={() => handleReset(true)}
            onClearError={clearError}
          />
        );
        
      case AppOverallStatus.OPENING_ANALYSIS_COMPLETED:
      case AppOverallStatus.FULL_NOVEL_ANALYSIS_COMPLETED:
        return <AnalysisCompleted state={state} onReset={() => handleReset(false)} />;

      case AppOverallStatus.ERROR:
        return <ErrorView state={state} onReset={() => handleReset(true)} />;
      
      case AppOverallStatus.CANCELLED:
        return <CancelledScreen onReset={() => handleReset(false)} />;

      default:
        return (
          <div className="text-center p-6">
            <Spinner size="lg" />
            <p className="mt-4 text-slate-400">正在加载应用或处理未知状态...</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen py-8 sm:py-12">
      <header className="mb-12 text-center px-4">
        <div className="inline-block bg-slate-800/50 rounded-full px-4 py-1.5 mb-4 border border-cyan-500/20">
            <p className="text-sm font-medium text-cyan-400">Powered by Gemini 2.5 Flash</p>
        </div>
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold bg-gradient-to-r from-cyan-300 via-teal-300 to-sky-400 bg-clip-text text-transparent pb-2 tracking-tight title-shimmer">
          {APP_NAME}
        </h1>
        <p className="text-slate-400 text-lg sm:text-xl max-w-3xl mx-auto mt-4">
          AI 驱动的网络小说深度拆解与评估工具。上传您的小说，洞悉其结构、节奏与潜力。
        </p>
      </header>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
         <div className="main-card rounded-2xl p-6 sm:p-8">
            {geminiAi && state.appStatus === AppOverallStatus.IDLE && (
                 <div className="p-4 bg-emerald-500/10 border border-emerald-400/20 rounded-lg text-emerald-300 text-center mb-6 shadow-lg flex items-center justify-center space-x-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold">AI 服务已就绪。请选择分析模式开始。</span>
                </div>
            )}
            {renderContent()}
         </div>
      </main>
      <footer className="text-center mt-16 py-8" style={{ borderTop: '1px solid', borderImage: 'linear-gradient(to right, transparent, var(--clr-cyan-500), transparent) 1' }}>
        <div className="flex justify-center items-center space-x-2 mb-2 text-slate-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <p className="text-sm">
                Developed by <strong className="font-semibold text-slate-400">haoyxy</strong>
            </p>
        </div>
        <p className="text-sm text-slate-500">
          {APP_NAME} &copy; {new Date().getFullYear()}. Powered by Google Gemini API.
        </p>
         <p className="text-xs text-slate-600 mt-2">
            版本: {APP_PERSISTENCE_VERSION}
        </p>
      </footer>
    </div>
  );
};

export default App;
