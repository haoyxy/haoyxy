import React, { useState, useEffect } from 'react';
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
import { CreativeBriefInput } from './components/CreativeBriefInput';
import { ViabilityReportDisplay } from './components/ViabilityReportDisplay';
import { ChapterInput } from './components/ChapterInput';
import { ChapterReportDisplay } from './components/ChapterReportDisplay';


const APP_PERSISTENCE_VERSION = "1.0.1";
const API_KEY = process.env.API_KEY;

const App: React.FC = () => {
  const [geminiAi, setGeminiAi] = useState<GoogleGenAI | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  const {
    state,
    workerLogs,
    estimatedTimeRemaining,
    handleModeSelect,
    handleFileSelected,
    handleTextSubmit,
    handleViabilityBriefSubmit,
    handleChapterSubmit,
    handlePause,
    handleResume,
    handleCancel,
    handleReset,
    clearError,
  } = useAppState(geminiAi);

  useEffect(() => {
    if (API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        setGeminiAi(ai);
      } catch (error) {
        console.error("Failed to initialize GoogleGenAI client:", error);
        setInitError("AI 服务初始化失败，请检查 API Key。");
      }
    } else {
      setInitError("API 密钥未配置。应用无法连接到 AI 服务。");
    }
  }, []);

  const renderContent = () => {
    if (initError) {
        return <ErrorView state={state} errorOverride={initError} onReset={() => window.location.reload()} />;
    }
      
    const isProcessing = state.appStatus === AppOverallStatus.READING_CHUNKS ||
                         state.appStatus === AppOverallStatus.ANALYZING_CHUNKS ||
                         state.appStatus === AppOverallStatus.GENERATING_OPENING_ASSESSMENT ||
                         state.appStatus === AppOverallStatus.GENERATING_FULL_NOVEL_REPORT ||
                         state.appStatus === AppOverallStatus.ANALYZING_VIABILITY ||
                         state.appStatus === AppOverallStatus.ANALYZING_CHAPTER;

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
                {!geminiAi && <p className="text-center text-red-400 font-medium">AI 服务未初始化，无法上传文件进行分析。</p>}
            </div>
        );
      
      case AppOverallStatus.AWAITING_VIABILITY_BRIEF:
        return (
            <div className="space-y-6">
                <BackButton onClick={() => handleReset(false)} text="返回选择模式" />
                <CreativeBriefInput
                    onBriefSubmit={handleViabilityBriefSubmit}
                    disabled={!geminiAi}
                />
            </div>
        );

      case AppOverallStatus.ANALYZING_VIABILITY:
        return (
          <div className="text-center p-10 space-y-6">
            <Spinner size="lg" />
            <p className="text-xl text-cyan-300 font-semibold animate-pulse">
              正在进行 AI 深度分析，请稍候...
            </p>
            <p className="text-slate-400">正在评估您的创意新颖度、市场潜力并预警风险点。</p>
          </div>
        );
        
      case AppOverallStatus.VIABILITY_ANALYSIS_COMPLETED:
        return (
            <div className="space-y-8">
                <BackButton onClick={() => handleReset(false)} text="分析新创意" />
                {state.viabilityReport && <ViabilityReportDisplay report={state.viabilityReport} />}
            </div>
        );

      case AppOverallStatus.AWAITING_CHAPTER_INPUT:
        return (
          <div className="space-y-6">
              <BackButton onClick={() => handleReset(false)} text="返回选择模式" />
              <ChapterInput
                  onChapterSubmit={handleChapterSubmit}
                  disabled={!geminiAi}
              />
          </div>
        );
      
      case AppOverallStatus.ANALYZING_CHAPTER:
        return (
          <div className="text-center p-10 space-y-6">
            <Spinner size="lg" />
            <p className="text-xl text-cyan-300 font-semibold animate-pulse">
              正在进行章节量化评估...
            </p>
            <p className="text-slate-400">AI 正在分析剧情推进、信息密度、冲突爽点与悬念钩子。</p>
          </div>
        );

      case AppOverallStatus.CHAPTER_ANALYSIS_COMPLETED:
        return (
          <div className="space-y-8">
              <BackButton onClick={() => handleReset(false)} text="评估新章节" />
              {state.chapterReport && <ChapterReportDisplay report={state.chapterReport} />}
          </div>
        );

      case AppOverallStatus.FILE_SELECTED:
      case AppOverallStatus.READING_CHUNKS:
      case AppOverallStatus.ANALYZING_CHUNKS:
      case AppOverallStatus.GENERATING_OPENING_ASSESSMENT:
      case AppOverallStatus.GENERATING_FULL_NOVEL_REPORT:
        return (
          <AnalysisInProgress
            state={state}
            isProcessing={isProcessing}
            progress={{ current: currentStep, total: totalSteps, percentage: progress }}
            estimatedTimeRemaining={estimatedTimeRemaining}
            onCancel={handleCancel}
            onPause={handlePause}
            onClearError={clearError}
            workerLogs={workerLogs}
          />
        );

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
            {!geminiAi && !initError && (
                 <div className="p-4 bg-yellow-500/10 border border-yellow-400/20 rounded-lg text-center mb-6 flex items-center justify-center space-x-3">
                    <Spinner size="sm" color="text-yellow-400"/>
                    <p className="text-yellow-300 font-semibold">正在初始化 AI 服务... 请稍候。</p>
                </div>
            )}
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