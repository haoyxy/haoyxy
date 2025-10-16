import { useState, useCallback, useEffect, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { NovelChunk, ChunkStatus, AppState, AppOverallStatus, AnalysisMode, PersistedProgressData, ExtractedEntity } from '../types';
import { useGeminiClient } from './useGeminiClient';
import { useFileProcessor, FileProcessorCallbacks } from './useFileProcessor';
import { useTimeEstimator } from './useTimeEstimator';
import { useAnalysisOrchestrator } from './useAnalysisOrchestrator';
import * as Persistence from './analysisPersistence';
import { startNovelAnalysisChat } from '../public/services/geminiService';

const initialState: AppState = {
  analysisMode: null,
  file: null,
  fileName: null,
  chunks: [],
  currentChatInstance: null,
  openingAssessment: null,
  fullNovelReport: null,
  appStatus: AppOverallStatus.IDLE,
  error: null,
  currentProcessingChunkOrder: 0,
  totalChunksToProcess: 0,
  actualTotalChunksInFile: 0,
  knowledgeBase: new Map(),
  allKnownEntities: new Map<string, ExtractedEntity>(),
  analysisIdentifier: null,
  lastSuccessfullyProcessedChunkOrder: -1,
  chunkingProgress: null,
};

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

export const useAppState = (initialGeminiAi: GoogleGenAI | null) => {
  const [state, setState] = useState<AppState>(initialState);

  const { currentAiClient, handleApiKeyOverride: handleApiOverride, resetClient } = useGeminiClient(initialGeminiAi);
  const { estimatedTimeRemaining, updateProcessingTime, resetEstimator } = useTimeEstimator(state);
  
  const { 
    pauseProcessing, 
    resumeProcessing, 
    abortAllRequests 
  } = useAnalysisOrchestrator(state, setState, currentAiClient, updateProcessingTime);

  const fileProcessorCallbacks = useMemo<FileProcessorCallbacks>(() => ({
    onError: (errorMessage) => {
      setState(prev => ({ ...prev, error: `文件处理错误: ${errorMessage}`, appStatus: AppOverallStatus.ERROR }));
    },
    onChunkingStart: (actualTotalChunks, totalToProcess) => {
      setState(prev => ({
        ...prev,
        actualTotalChunksInFile: actualTotalChunks,
        totalChunksToProcess: totalToProcess,
        appStatus: AppOverallStatus.ANALYZING_CHUNKS,
        currentProcessingChunkOrder: 0,
        chunks: [],
        chunkingProgress: 0, // Start progress at 0
      }));
    },
    onChunkingProgress: (progress) => {
        setState(prev => ({ ...prev, chunkingProgress: progress }));
    },
    onFirstChunk: (firstChunk) => {
      let chatInstance = null;
      let nextStatus = AppOverallStatus.ANALYZING_CHUNKS;
      let startError = null;

      if (state.analysisMode === "opening") {
        if (currentAiClient) {
          try {
            chatInstance = startNovelAnalysisChat(currentAiClient);
          } catch (e: any) {
            startError = `无法启动 AI 对话来进行开篇分析: ${e.message}`;
            nextStatus = AppOverallStatus.ERROR;
          }
        } else {
          startError = "无法启动 AI 对话来进行开篇分析：AI 服务尚未就绪。";
          nextStatus = AppOverallStatus.ERROR;
        }
      }
      
      setState(prev => ({
        ...prev,
        chunks: [firstChunk],
        appStatus: nextStatus,
        currentChatInstance: chatInstance,
        error: startError,
        chunkingProgress: 100, // Mark chunking as complete
      }));
    },
    onChunkBatch: (newChunks) => {
      setState(prev => ({
        ...prev,
        chunks: [...prev.chunks, ...newChunks].sort((a, b) => a.order - b.order),
      }));
    },
    onCompleted: (actualTotalChunks, totalProcessed) => {
      setState(prev => {
        if (prev.chunks.length === 0 && totalProcessed === 0) {
          return { ...prev, error: "文件已处理，但未生成任何文本分块。可能是文件内容为空或无法识别。", appStatus: AppOverallStatus.ERROR };
        }
        return { ...prev, chunkingProgress: 100 }; // Ensure it ends at 100
      });
    },
  }), [state.analysisMode, currentAiClient]);

  const { processFileInWorker, workerLogs, killWorker } = useFileProcessor(fileProcessorCallbacks);
  
  const handleReset = useCallback((clearFullProgress = false) => {
    killWorker();
    abortAllRequests();
    pauseProcessing();
    resetEstimator();
    
    if (clearFullProgress && state.analysisIdentifier) {
        Persistence.clearProgressFromLocalStorage(state.analysisIdentifier);
    }

    setState(initialState);
    resetClient();
    scrollToTop();
  }, [state.analysisIdentifier, killWorker, abortAllRequests, pauseProcessing, resetEstimator, resetClient]);

  const handleModeSelect = useCallback((mode: AnalysisMode) => {
    handleReset();
    setState(prev => ({ ...prev, analysisMode: mode, appStatus: AppOverallStatus.MODE_SELECTED }));
  }, [handleReset]);
  
  const startFreshAnalysis = useCallback((file: File | null, text: string | null, mode: AnalysisMode) => {
      const id = file ? `file-${file.name}-${file.size}-${file.lastModified}-${mode}` : `pasted-${Date.now()}`;
      const name = file ? file.name : `Pasted Text (${(text!.length / 1024).toFixed(2)} KB)`;

      setState({
        ...initialState,
        analysisMode: mode,
        file: file,
        fileName: name,
        analysisIdentifier: id,
        appStatus: AppOverallStatus.PREPARING_ANALYSIS,
      });
      processFileInWorker(file, text, mode);
  }, [processFileInWorker]);


  const handleFileSelected = useCallback((selectedFile: File) => {
    const currentMode = state.analysisMode;
    if (!currentMode) {
      setState(prev => ({ ...prev, error: "请先选择分析模式！", appStatus: AppOverallStatus.ERROR }));
      return;
    }
    handleReset(false);

    const fileIdentifier = `file-${selectedFile.name}-${selectedFile.size}-${selectedFile.lastModified}-${currentMode}`;
    const existingProgress = Persistence.loadProgressFromLocalStorage(fileIdentifier);

    if (existingProgress) {
      const shouldResume = window.confirm(`检测到该文件上次的分析进度，是否继续？\n\n上次分析到: 分块 ${existingProgress.lastSuccessfullyProcessedChunkOrder + 1} / ${existingProgress.totalChunksToProcess}\n\n选择“确定”继续分析，选择“取消”则开始新的分析。`);
      if (shouldResume) {
        setState(prev => ({
          ...prev,
          analysisMode: existingProgress.analysisMode,
          file: selectedFile,
          fileName: existingProgress.fileName,
          chunks: existingProgress.chunks.map(pc => ({
            id: pc.id, fileChunk: new Blob([]), order: pc.order, analysis: pc.analysis,
            summary: pc.summary, status: pc.status, error: pc.error,
          })),
          openingAssessment: existingProgress.openingAssessment,
          fullNovelReport: existingProgress.fullNovelReport,
          knowledgeBase: new Map(existingProgress.knowledgeBaseEntries),
          allKnownEntities: new Map(existingProgress.allKnownEntitiesArray),
          analysisIdentifier: existingProgress.analysisIdentifier,
          lastSuccessfullyProcessedChunkOrder: existingProgress.lastSuccessfullyProcessedChunkOrder,
          totalChunksToProcess: existingProgress.totalChunksToProcess,
          actualTotalChunksInFile: existingProgress.actualTotalChunksInFile,
          appStatus: AppOverallStatus.PAUSED_AWAITING_RESUME,
          currentProcessingChunkOrder: existingProgress.lastSuccessfullyProcessedChunkOrder + 1,
        }));
      } else {
        Persistence.clearProgressFromLocalStorage(fileIdentifier);
        startFreshAnalysis(selectedFile, null, currentMode);
      }
    } else {
      startFreshAnalysis(selectedFile, null, currentMode);
    }
  }, [state.analysisMode, handleReset, startFreshAnalysis]);

  const handleTextSubmit = useCallback((pastedText: string) => {
    const currentMode = state.analysisMode;
    if (!currentMode) {
        setState(prev => ({ ...prev, error: "请先选择分析模式！", appStatus: AppOverallStatus.ERROR }));
        return;
    }
    handleReset(false);
    startFreshAnalysis(null, pastedText, currentMode);
  }, [state.analysisMode, handleReset, startFreshAnalysis]);

  const handlePause = useCallback(() => {
    pauseProcessing();
    setState(prev => ({
        ...prev,
        appStatus: AppOverallStatus.PAUSED_AWAITING_RESUME,
        chunks: prev.chunks.map(c => 
            c.status === ChunkStatus.ANALYZING || c.status === ChunkStatus.READING
            ? { ...c, status: ChunkStatus.PENDING_ANALYSIS, error: (c.error || "") + " (处理被暂停)" } 
            : c
        )
    }));
    Persistence.saveProgressToLocalStorage(state);
  }, [state, pauseProcessing]);
  
  const handleResume = useCallback(() => {
    if (!state.analysisIdentifier) {
        setState(prev => ({...prev, error: "无法继续：未找到分析任务标识。", appStatus: AppOverallStatus.ERROR}));
        return;
    }

    resumeProcessing();
    let nextStatus = AppOverallStatus.ANALYZING_CHUNKS;
    let chatInstance = state.currentChatInstance;

    if (state.analysisMode === 'opening' && !chatInstance && currentAiClient) {
        try {
            chatInstance = startNovelAnalysisChat(currentAiClient);
        } catch (e: any) {
            setState(prev => ({ ...prev, error: `恢复时无法启动 AI 对话: ${e.message}`, appStatus: AppOverallStatus.ERROR }));
            return;
        }
    }
    
    setState(prev => ({
        ...prev,
        appStatus: nextStatus,
        currentChatInstance: chatInstance, 
        currentProcessingChunkOrder: prev.lastSuccessfullyProcessedChunkOrder + 1,
        error: null,
    }));
  }, [state.analysisIdentifier, state.analysisMode, state.currentChatInstance, state.lastSuccessfullyProcessedChunkOrder, resumeProcessing, currentAiClient]);

  const handleCancel = useCallback(() => {
    handleReset(true); 
    setState(prev => ({...prev, appStatus: AppOverallStatus.CANCELLED }));
  }, [handleReset]);

  const clearError = useCallback(() => {
    if (state.appStatus !== AppOverallStatus.PAUSED_RATE_LIMITED) {
        setState(prev => ({ ...prev, error: null }));
    }
  }, [state.appStatus]);
  
  const handleApiKeyOverride = useCallback(async (newKey: string): Promise<{ success: boolean; error?: string; }> => {
    const result = await handleApiOverride(newKey);
    if(result.success) {
      resumeProcessing();
      setState(prev => ({ ...prev, appStatus: AppOverallStatus.ANALYZING_CHUNKS, error: null }));
    }
    return result;
  }, [handleApiOverride, resumeProcessing]);

  useEffect(() => {
    if (state.analysisIdentifier && (state.appStatus === AppOverallStatus.ANALYZING_CHUNKS || state.appStatus === AppOverallStatus.PAUSED_AWAITING_RESUME || state.appStatus === AppOverallStatus.PAUSED_RATE_LIMITED) && state.lastSuccessfullyProcessedChunkOrder >= 0) {
      Persistence.saveProgressToLocalStorage(state);
    }
  }, [state]);

  return {
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
  };
};