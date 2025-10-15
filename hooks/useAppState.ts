import { useState, useCallback, useEffect, useRef } from 'react';
import { NovelChunk, ChunkStatus, AppState, AppOverallStatus, AnalysisMode, ChunkAnalysisResponse, PersistedProgressData, ViabilityReport, ChapterReport } from '../types';
import { CHUNK_SIZE, MAX_RELEVANT_HISTORICAL_ENTITIES, MAX_CHUNKS_FOR_OPENING_ANALYSIS, MAX_CONCURRENT_REQUESTS_FULL_MODE, INTER_CHUNK_API_DELAY_MS_OPENING, INTER_CHUNK_API_DELAY_MS_FULL } from '../constants';
import { 
  startNovelAnalysisChat, 
  analyzeNovelChunkInChat, 
  concludeOpeningAssessmentInChat,
  analyzeNovelChunkForFullMode,
  concludeFullNovelReportInChat,
  analyzeCreativeViability,
  analyzeChapterQuality
} from '../public/services/geminiService';
import type { Chat } from '@google/genai';
import { GoogleGenAI } from '@google/genai';

const APP_PERSISTENCE_VERSION = "1.0.1";
const MAMMOTH_SCRIPT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js';

const initialState: AppState = {
  analysisMode: null,
  file: null,
  fileName: null,
  chunks: [],
  currentChatInstance: null,
  openingAssessment: null,
  fullNovelReport: null,
  viabilityReport: null,
  chapterReport: null,
  appStatus: AppOverallStatus.IDLE,
  error: null,
  currentProcessingChunkOrder: 0,
  totalChunksToProcess: 0,
  actualTotalChunksInFile: 0,
  knowledgeBase: new Map(),
  allKnownEntities: new Set(),
  analysisIdentifier: null,
  lastSuccessfullyProcessedChunkOrder: -1,
};

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

export const useAppState = (geminiAi: GoogleGenAI | null) => {
  const [state, setState] = useState<AppState>(initialState);
  const workerRef = useRef<Worker | null>(null);
  const activeRequestCountRef = useRef(0);
  const isProcessingPausedRef = useRef(false);
  const abortControllersRef = useRef<AbortController[]>([]);
  const [workerLogs, setWorkerLogs] = useState<string[]>([]);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string | null>(null);
  const chunkProcessingTimesRef = useRef<number[]>([]);

  const saveProgressToLocalStorage = useCallback((currentAppState: AppState) => {
    if (!currentAppState.analysisIdentifier) return;
    try {
      const dataToSave: PersistedProgressData = {
        appVersion: APP_PERSISTENCE_VERSION,
        analysisIdentifier: currentAppState.analysisIdentifier,
        analysisMode: currentAppState.analysisMode!,
        fileName: currentAppState.fileName!,
        chunks: currentAppState.chunks.map(c => ({ 
          id: c.id, 
          order: c.order, 
          analysis: c.analysis, 
          summary: c.summary, 
          status: c.status, 
          error: c.error 
        })),
        openingAssessment: currentAppState.openingAssessment,
        fullNovelReport: currentAppState.fullNovelReport,
        knowledgeBaseEntries: Array.from(currentAppState.knowledgeBase.entries()),
        allKnownEntitiesArray: Array.from(currentAppState.allKnownEntities),
        lastSuccessfullyProcessedChunkOrder: currentAppState.lastSuccessfullyProcessedChunkOrder,
        totalChunksToProcess: currentAppState.totalChunksToProcess,
        actualTotalChunksInFile: currentAppState.actualTotalChunksInFile,
        timestamp: Date.now(),
      };
      localStorage.setItem(`progress-${currentAppState.analysisIdentifier}`, JSON.stringify(dataToSave));
      console.log(`Progress saved for ${currentAppState.analysisIdentifier} at chunk ${currentAppState.lastSuccessfullyProcessedChunkOrder}`);
    } catch (error) {
      console.error("Failed to save progress to localStorage:", error);
    }
  }, []);
  
  const loadProgressFromLocalStorage = useCallback((identifier: string): PersistedProgressData | null => {
    try {
      const savedData = localStorage.getItem(`progress-${identifier}`);
      if (savedData) {
        const parsedData = JSON.parse(savedData) as PersistedProgressData;
        if (parsedData.appVersion === APP_PERSISTENCE_VERSION && parsedData.analysisIdentifier === identifier) {
          console.log(`Progress loaded for ${identifier}, last processed chunk: ${parsedData.lastSuccessfullyProcessedChunkOrder}`);
          return parsedData;
        } else {
          console.warn(`Progress data for ${identifier} is outdated or mismatched. Ignoring.`);
          localStorage.removeItem(`progress-${identifier}`);
        }
      }
    } catch (error) {
      console.error("Failed to load progress from localStorage:", error);
    }
    return null;
  }, []);

  const clearProgressFromLocalStorage = useCallback((identifier: string | null) => {
    if (!identifier) return;
    try {
      localStorage.removeItem(`progress-${identifier}`);
      console.log(`Progress cleared for ${identifier}`);
    } catch (error) {
      console.error("Failed to clear progress from localStorage:", error);
    }
  }, []);

  const handleReset = useCallback((clearFullProgress = false) => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    abortControllersRef.current.forEach(controller => controller.abort());
    abortControllersRef.current = [];
    activeRequestCountRef.current = 0;
    isProcessingPausedRef.current = false;
    chunkProcessingTimesRef.current = [];
    
    if (clearFullProgress && state.analysisIdentifier) {
        clearProgressFromLocalStorage(state.analysisIdentifier);
    }

    setState(initialState);
    setWorkerLogs([]);
    setEstimatedTimeRemaining(null);
    scrollToTop();
  }, [state.analysisIdentifier, clearProgressFromLocalStorage]);

  const handleModeSelect = useCallback((mode: AnalysisMode) => {
    handleReset();
    if (mode === 'viability') {
        setState(prev => ({ ...prev, analysisMode: mode, appStatus: AppOverallStatus.AWAITING_VIABILITY_BRIEF }));
    } else if (mode === 'chapter') {
        setState(prev => ({ ...prev, analysisMode: mode, appStatus: AppOverallStatus.AWAITING_CHAPTER_INPUT }));
    } else {
        setState(prev => ({ ...prev, analysisMode: mode, appStatus: AppOverallStatus.MODE_SELECTED }));
    }
  }, [handleReset]);

  const handleViabilityBriefSubmit = useCallback(async (brief: string) => {
    if (!geminiAi) {
        setState(prev => ({ ...prev, error: "AI 服务未就绪，无法进行分析。", appStatus: AppOverallStatus.ERROR }));
        return;
    }
    setState(prev => ({
        ...prev,
        appStatus: AppOverallStatus.ANALYZING_VIABILITY,
        fileName: `创意简介分析 (${(brief.length / 1024).toFixed(1)} KB)`,
        error: null,
    }));
    try {
        const report = await analyzeCreativeViability(geminiAi, brief);
        setState(prev => ({
            ...prev,
            viabilityReport: report,
            appStatus: AppOverallStatus.VIABILITY_ANALYSIS_COMPLETED,
        }));
    } catch (err: any) {
        setState(prev => ({
            ...prev,
            error: `创意分析失败: ${err.message}`,
            appStatus: AppOverallStatus.ERROR,
        }));
    }
  }, [geminiAi]);

  const handleChapterSubmit = useCallback(async (chapterText: string) => {
    if (!geminiAi) {
        setState(prev => ({ ...prev, error: "AI 服务未就绪，无法进行分析。", appStatus: AppOverallStatus.ERROR }));
        return;
    }
    setState(prev => ({
        ...prev,
        appStatus: AppOverallStatus.ANALYZING_CHAPTER,
        fileName: `章节评估 (${(chapterText.length / 1024).toFixed(1)} KB)`,
        error: null,
    }));
    try {
        const report = await analyzeChapterQuality(geminiAi, chapterText);
        setState(prev => ({
            ...prev,
            chapterReport: report,
            appStatus: AppOverallStatus.CHAPTER_ANALYSIS_COMPLETED,
        }));
    } catch (err: any) {
        setState(prev => ({
            ...prev,
            error: `章节评估失败: ${err.message}`,
            appStatus: AppOverallStatus.ERROR,
        }));
    }
  }, [geminiAi]);
  
  const processFileInWorker = useCallback((file: File | null, textInput: string | null = null) => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }
    setWorkerLogs([]);
    chunkProcessingTimesRef.current = [];

    workerRef.current = new Worker(new URL('../public/fileProcessor.worker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (event) => {
      const { type, error, message, actualTotalChunksInFile, totalChunksToProcess, usedEncoding, totalChunksProcessed } = event.data;
      
      setWorkerLogs(prevLogs => [...prevLogs, `Worker: ${type} - ${message || error || `Received ${type} event`}`]);

      if (type === 'error') {
        setState(prev => ({ ...prev, error: `文件处理错误: ${error}`, appStatus: AppOverallStatus.ERROR }));
        if (workerRef.current) workerRef.current.terminate();
      } else if (type === 'warning') {
        console.warn("Worker warning:", message);
      } else if (type === 'info') {
        console.log("Worker info:", message);
      } else if (type === 'chunking_started') {
        setState(prev => ({
          ...prev,
          actualTotalChunksInFile,
          totalChunksToProcess,
          appStatus: AppOverallStatus.READING_CHUNKS,
          currentProcessingChunkOrder: 0,
          chunks: []
        }));
      } else if (type === 'first_chunk') {
        const { chunkBuffer, order } = event.data;
        const firstChunk: NovelChunk = {
            id: `chunk-${order}-${Date.now()}`,
            fileChunk: new Blob([chunkBuffer], { type: 'application/octet-stream' }),
            order: order,
            status: ChunkStatus.PENDING_READ,
        };
        
        let chatInstance: Chat | null = null;
        let nextStatus = AppOverallStatus.ANALYZING_CHUNKS;
        let startError: string | null = null;

        if (state.analysisMode === "opening") {
            if (geminiAi) {
                try {
                    chatInstance = startNovelAnalysisChat(geminiAi);
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
            currentChatInstance: chatInstance ?? prev.currentChatInstance,
            error: startError,
        }));

      } else if (type === 'chunk_batch') {
          const { chunks: chunkDataBatch } = event.data;
          const newChunks: NovelChunk[] = chunkDataBatch.map((c: any) => ({
              id: `chunk-${c.order}-${Date.now()}`,
              fileChunk: new Blob([c.chunkBuffer], { type: 'application/octet-stream' }),
              order: c.order,
              status: ChunkStatus.PENDING_READ,
          }));

          setState(prev => ({
              ...prev,
              chunks: [...prev.chunks, ...newChunks].sort((a,b) => a.order - b.order)
          }));
      } else if (type === 'completed') {
         setState(prev => {
            if (prev.chunks.length === 0 && totalChunksProcessed === 0) {
              return { ...prev, error: "文件已处理，但未生成任何文本分块。可能是文件内容为空或无法识别。", appStatus: AppOverallStatus.ERROR };
            }
             return prev;
        });
        if (workerRef.current) workerRef.current.terminate();
        console.log(`Worker finished. Encoding used: ${usedEncoding}. Total chunks processed by worker: ${totalChunksProcessed}`);
      }
    };
    
    workerRef.current.onerror = (err) => {
        setWorkerLogs(prevLogs => [...prevLogs, `Worker Error: ${err.message}`]);
        setState(prev => ({ ...prev, error: `文件处理工作线程发生意外错误: ${err.message}`, appStatus: AppOverallStatus.ERROR }));
        if (workerRef.current) workerRef.current.terminate();
    };

    workerRef.current.postMessage({
        file: file, 
        textInput: textInput, 
        chunkSize: CHUNK_SIZE,
        mode: state.analysisMode,
        maxChunksForOpening: MAX_CHUNKS_FOR_OPENING_ANALYSIS,
        mammothUrl: MAMMOTH_SCRIPT_URL,
    });
  }, [state.analysisMode, geminiAi]);

  const handleFileSelected = useCallback((selectedFile: File) => {
    const currentMode = state.analysisMode;
    if (!currentMode) {
      setState(prev => ({ ...prev, error: "请先选择分析模式！", appStatus: AppOverallStatus.ERROR }));
      return;
    }

    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    abortControllersRef.current.forEach(controller => controller.abort());
    abortControllersRef.current = [];
    activeRequestCountRef.current = 0;
    isProcessingPausedRef.current = false;
    chunkProcessingTimesRef.current = [];
    setWorkerLogs([]);
    setEstimatedTimeRemaining(null);

    const fileIdentifier = `file-${selectedFile.name}-${selectedFile.size}-${selectedFile.lastModified}-${currentMode}`;
    const existingProgress = loadProgressFromLocalStorage(fileIdentifier);

    if (existingProgress) {
      setState(prev => ({
        ...prev,
        analysisMode: existingProgress.analysisMode,
        file: selectedFile, 
        fileName: existingProgress.fileName,
        chunks: existingProgress.chunks.map(pc => ({
          id: pc.id,
          fileChunk: new Blob([]), 
          order: pc.order,
          analysis: pc.analysis,
          summary: pc.summary,
          status: pc.status,
          error: pc.error,
        })),
        openingAssessment: existingProgress.openingAssessment,
        fullNovelReport: existingProgress.fullNovelReport,
        knowledgeBase: new Map(existingProgress.knowledgeBaseEntries),
        allKnownEntities: new Set(existingProgress.allKnownEntitiesArray),
        analysisIdentifier: existingProgress.analysisIdentifier,
        lastSuccessfullyProcessedChunkOrder: existingProgress.lastSuccessfullyProcessedChunkOrder,
        totalChunksToProcess: existingProgress.totalChunksToProcess,
        actualTotalChunksInFile: existingProgress.actualTotalChunksInFile,
        appStatus: AppOverallStatus.PAUSED_AWAITING_RESUME, 
        error: null,
        currentProcessingChunkOrder: existingProgress.lastSuccessfullyProcessedChunkOrder + 1
      }));
       console.log("Resumable progress found and loaded.");
    } else {
      setState({
        ...initialState,
        analysisMode: currentMode,
        file: selectedFile,
        fileName: selectedFile.name,
        analysisIdentifier: fileIdentifier,
        appStatus: AppOverallStatus.FILE_SELECTED,
        error: null,
      });
      processFileInWorker(selectedFile, null);
    }
  }, [state.analysisMode, processFileInWorker, loadProgressFromLocalStorage]);

  const handleTextSubmit = useCallback((pastedText: string) => {
    const currentMode = state.analysisMode;
    if (!currentMode) {
        setState(prev => ({ ...prev, error: "请先选择分析模式！", appStatus: AppOverallStatus.ERROR }));
        return;
    }

    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    abortControllersRef.current.forEach(controller => controller.abort());
    abortControllersRef.current = [];
    activeRequestCountRef.current = 0;
    isProcessingPausedRef.current = false;
    chunkProcessingTimesRef.current = [];
    setWorkerLogs([]);
    setEstimatedTimeRemaining(null);

    const textIdentifier = `pasted-${Date.now()}`;
    const fileName = `Pasted Text (${(pastedText.length / 1024).toFixed(2)} KB)`;

    setState({
        ...initialState,
        analysisMode: currentMode,
        fileName: fileName,
        analysisIdentifier: textIdentifier,
        appStatus: AppOverallStatus.FILE_SELECTED,
        error: null,
    });
    processFileInWorker(null, pastedText);
  }, [state.analysisMode, processFileInWorker]);

  const readAndProcessNextChunk = useCallback(async () => {
    if (isProcessingPausedRef.current || !geminiAi) return;

    const { chunks, currentProcessingChunkOrder, totalChunksToProcess, analysisMode } = state;
    
    if (currentProcessingChunkOrder >= totalChunksToProcess) {
      console.warn(`readAndProcessNextChunk called for out-of-bounds chunk order ${currentProcessingChunkOrder}.`);
      return;
    }

    const chunkToProcess = chunks.find(c => c.order === currentProcessingChunkOrder);

    if (!chunkToProcess) {
        console.warn(`Chunk order ${currentProcessingChunkOrder} not found. Moving to next.`);
        return;
    }
    
    if (chunkToProcess.status === ChunkStatus.ANALYZED) {
        console.log(`Chunk ${chunkToProcess.order} already analyzed. Skipping.`);
        setState(prev => ({
            ...prev,
            currentProcessingChunkOrder: prev.currentProcessingChunkOrder + 1,
            lastSuccessfullyProcessedChunkOrder: Math.max(prev.lastSuccessfullyProcessedChunkOrder, chunkToProcess.order)
        }));
        return;
    }
    if (chunkToProcess.status === ChunkStatus.ERROR && chunkToProcess.error) {
         console.warn(`Chunk ${chunkToProcess.order} previously errored: ${chunkToProcess.error}. Skipping.`);
         setState(prev => ({ ...prev, currentProcessingChunkOrder: prev.currentProcessingChunkOrder + 1 }));
         return;
    }

    let textContent = '';
    try {
        if (chunkToProcess.fileChunk.size > 0) { 
            setState(prev => ({
                ...prev,
                chunks: prev.chunks.map(c => c.id === chunkToProcess.id ? { ...c, status: ChunkStatus.READING } : c)
            }));
            const textDecoder = new TextDecoder('utf-8'); 
            textContent = textDecoder.decode(await chunkToProcess.fileChunk.arrayBuffer());
        } else {
            console.warn(`Chunk ${chunkToProcess.order} has an empty fileChunk. Skipping analysis or treating as error.`);
            setState(prev => ({
                ...prev,
                chunks: prev.chunks.map(c => c.id === chunkToProcess.id ? { ...c, status: ChunkStatus.ERROR, error:"块内容为空" } : c),
                currentProcessingChunkOrder: prev.currentProcessingChunkOrder + 1
            }));
            return;
        }
    } catch (readError: any) {
        console.error(`Error reading chunk ${chunkToProcess.order}:`, readError);
        setState(prev => ({
            ...prev,
            chunks: prev.chunks.map(c => c.id === chunkToProcess.id ? { ...c, status: ChunkStatus.ERROR, error: `读取块内容失败: ${readError.message}` } : c),
            currentProcessingChunkOrder: prev.currentProcessingChunkOrder + 1, 
            error: `读取分块 ${chunkToProcess.order + 1} 失败，已跳过。` 
        }));
        return; 
    }

    if (textContent.trim().length === 0) {
        console.log(`Chunk ${chunkToProcess.order} is empty after reading. Marking as analyzed (empty).`);
        setState(prev => ({
            ...prev,
            chunks: prev.chunks.map(c => c.id === chunkToProcess.id ? { ...c, status: ChunkStatus.ANALYZED, summary: "(内容为空)", analysis: "(内容为空)" } : c),
            lastSuccessfullyProcessedChunkOrder: Math.max(prev.lastSuccessfullyProcessedChunkOrder, chunkToProcess.order),
            currentProcessingChunkOrder: prev.currentProcessingChunkOrder + 1
        }));
        return;
    }

    setState(prev => ({
      ...prev,
      chunks: prev.chunks.map(c => c.id === chunkToProcess.id ? { ...c, status: ChunkStatus.ANALYZING, textContent: textContent } : c)
    }));

    const abortController = new AbortController();
    abortControllersRef.current.push(abortController);
    activeRequestCountRef.current++;

    const startTime = Date.now();
    try {
      let analysisResult: ChunkAnalysisResponse;

      if (analysisMode === "opening") {
        if (!state.currentChatInstance) {
          throw new Error(`无法处理分块 ${chunkToProcess.order + 1}：AI 对话实例未初始化。`);
        }
        const previousChunk = state.chunks.find(c => c.order === chunkToProcess.order - 1);
        const prevSummary = previousChunk?.summary;
        
        let relevantHistoricalContext = "";
        const currentEntities = state.allKnownEntities; 
        const MAX_CONTEXT_ITEMS = MAX_RELEVANT_HISTORICAL_ENTITIES;
        
        if (chunkToProcess.order > 0 && currentEntities.size > 0) {
            const recentMentions: string[] = [];
            let contextItemCount = 0;
            for (let i = chunkToProcess.order - 1; i >= 0 && contextItemCount < MAX_CONTEXT_ITEMS; i--) {
                const pc = state.chunks[i];
                if (pc && pc.summary && pc.status === ChunkStatus.ANALYZED) {
                        recentMentions.unshift(`先前内容片段 ${pc.order + 1} 提及的摘要: "${pc.summary}"`);
                        contextItemCount++;
                }
            }
            if (recentMentions.length > 0) {
                 relevantHistoricalContext = "为帮助理解当前内容，以下是先前内容中与已知关键信息相关的摘要回顾：\n" + recentMentions.join("\n");
            }
        }

        analysisResult = await analyzeNovelChunkInChat(
            state.currentChatInstance, 
            textContent, 
            chunkToProcess.order + 1, 
            totalChunksToProcess,
            prevSummary,
            relevantHistoricalContext
        );

      } else if (analysisMode === "full") {
         const previousChunk = state.chunks.find(c => c.order === chunkToProcess.order - 1);
         const prevSummary = previousChunk?.summary;
        analysisResult = await analyzeNovelChunkForFullMode(
            geminiAi,
            textContent, 
            chunkToProcess.order + 1,
            totalChunksToProcess, 
            prevSummary
        );
      } else {
        throw new Error(`未知的分析模式 "${analysisMode}"，无法处理分块。`);
      }

      const newKnowledgeBase = new Map(state.knowledgeBase);
      const newAllKnownEntities = new Set(state.allKnownEntities);
      (analysisResult.extractedEntities || []).forEach(entity => {
        if (entity && entity.trim() !== "") {
          newAllKnownEntities.add(entity.trim());
          if (!newKnowledgeBase.has(entity.trim())) {
            newKnowledgeBase.set(entity.trim(), {
              firstMentionOrder: chunkToProcess.order,
              summaryOfFirstMention: analysisResult.summary || "N/A"
            });
          }
        }
      });

      setState(prev => ({
        ...prev,
        chunks: prev.chunks.map(c => c.id === chunkToProcess.id ? { ...c, ...analysisResult, status: ChunkStatus.ANALYZED, textContent: undefined } : c),
        knowledgeBase: newKnowledgeBase,
        allKnownEntities: newAllKnownEntities,
        lastSuccessfullyProcessedChunkOrder: chunkToProcess.order,
        currentProcessingChunkOrder: prev.currentProcessingChunkOrder + 1,
        error: null 
      }));

    } catch (err: any) {
        let errorMessage = `AI分析分块 ${chunkToProcess.order + 1} 失败: ${err.message}`;
        if (err.isRateLimitError) {
            errorMessage = `AI分析分块 ${chunkToProcess.order + 1} 因达到API速率限制而失败: ${err.message}. 将在一段时间后重试当前块。`;
            console.warn(errorMessage);
             setState(prev => ({
                ...prev,
                chunks: prev.chunks.map(c => c.id === chunkToProcess.id ? { ...c, status: ChunkStatus.PENDING_ANALYSIS, error: "API速率限制，等待重试" } : c),
                error: errorMessage
            }));
        } else {
            console.error(errorMessage, err);
            setState(prev => ({
                ...prev,
                chunks: prev.chunks.map(c => c.id === chunkToProcess.id ? { ...c, status: ChunkStatus.ERROR, error: err.message, textContent: undefined } : c),
                currentProcessingChunkOrder: prev.currentProcessingChunkOrder + 1, 
                error: errorMessage 
            }));
        }
    } finally {
      const duration = Date.now() - startTime;
      chunkProcessingTimesRef.current.push(duration);
      if (chunkProcessingTimesRef.current.length > 10) {
        chunkProcessingTimesRef.current.shift();
      }
      activeRequestCountRef.current--;
      abortControllersRef.current = abortControllersRef.current.filter(c => c !== abortController);
    }
  }, [state, geminiAi]);

  const finalizeOpeningAssessment = useCallback(async () => {
    if (!geminiAi) {
        setState(prev => ({...prev, error: "AI 服务未就绪，无法生成开篇总结报告。", appStatus: AppOverallStatus.ERROR }));
        return;
    }
    isProcessingPausedRef.current = true; 

    try {
      const analyzedSummaries = state.chunks
        .filter(c => c.status === ChunkStatus.ANALYZED && c.summary && c.order < state.totalChunksToProcess)
        .sort((a, b) => a.order - b.order)
        .map(c => `分块 ${c.order + 1} 摘要：\n${c.summary}`)
        .join('\n\n');

      if (!analyzedSummaries || analyzedSummaries.trim().length === 0) {
        setState(prev => ({...prev, openingAssessment: "未能分析任何有效分块，无法生成开篇评估。", appStatus: AppOverallStatus.OPENING_ANALYSIS_COMPLETED }));
        return;
      }
      
      const assessment = await concludeOpeningAssessmentInChat(
        geminiAi,
        state.chunks.filter(c => c.status === ChunkStatus.ANALYZED && c.order < state.totalChunksToProcess).length,
        analyzedSummaries
      );
      
      setState(prev => ({ ...prev, openingAssessment: assessment, appStatus: AppOverallStatus.OPENING_ANALYSIS_COMPLETED, error: null }));
      if (state.analysisIdentifier) clearProgressFromLocalStorage(state.analysisIdentifier); 
    } catch (err: any) {
      console.error("Error finalizing opening assessment:", err);
      setState(prev => ({ ...prev, error: `生成开篇评估报告失败: ${err.message}`, appStatus: AppOverallStatus.ERROR }));
    } finally {
        isProcessingPausedRef.current = false;
    }
  }, [state.chunks, state.totalChunksToProcess, state.analysisIdentifier, clearProgressFromLocalStorage, geminiAi]);

  const finalizeFullReport = useCallback(async () => {
    if (!geminiAi) {
        setState(prev => ({...prev, error: "AI 服务未就绪，无法生成全本总结报告。", appStatus: AppOverallStatus.ERROR }));
        return;
    }
    isProcessingPausedRef.current = true;

    try {
      const allSummaries = state.chunks
        .filter(c => c.status === ChunkStatus.ANALYZED && c.summary)
        .sort((a, b) => a.order - b.order)
        .map(c => `分块 ${c.order + 1} (共 ${state.actualTotalChunksInFile} 个分块) 摘要：\n${c.summary}`)
        .join('\n\n');
      
      if (!allSummaries || allSummaries.trim().length === 0) {
        setState(prev => ({...prev, fullNovelReport: "未能分析任何有效分块，无法生成全本报告。", appStatus: AppOverallStatus.FULL_NOVEL_ANALYSIS_COMPLETED }));
        return;
      }

      const report = await concludeFullNovelReportInChat(
        geminiAi,
        state.fileName || "未知小说",
        state.chunks.filter(c => c.status === ChunkStatus.ANALYZED).length,
        allSummaries
      );
      setState(prev => ({ ...prev, fullNovelReport: report, appStatus: AppOverallStatus.FULL_NOVEL_ANALYSIS_COMPLETED, error: null }));
      if (state.analysisIdentifier) clearProgressFromLocalStorage(state.analysisIdentifier);
    } catch (err: any) {
      console.error("Error finalizing full novel report:", err);
      setState(prev => ({ ...prev, error: `生成全本分析报告失败: ${err.message}`, appStatus: AppOverallStatus.ERROR }));
    } finally {
        isProcessingPausedRef.current = false;
    }
  }, [state.chunks, state.fileName, state.actualTotalChunksInFile, state.analysisIdentifier, clearProgressFromLocalStorage, geminiAi]);

  const handlePause = useCallback(() => {
    isProcessingPausedRef.current = true;
    abortControllersRef.current.forEach(controller => controller.abort("用户暂停操作"));
    abortControllersRef.current = [];
    activeRequestCountRef.current = 0; 
    
    setState(prev => ({
        ...prev,
        appStatus: AppOverallStatus.PAUSED_AWAITING_RESUME,
        chunks: prev.chunks.map(c => 
            c.status === ChunkStatus.ANALYZING || c.status === ChunkStatus.READING
            ? { ...c, status: ChunkStatus.PENDING_ANALYSIS, error: (c.error || "") + " (处理被暂停)" } 
            : c
        )
    }));
    saveProgressToLocalStorage(state); 
    console.log("Analysis paused.");
  }, [state, saveProgressToLocalStorage]);

  const handleResume = useCallback(() => {
    if (!state.analysisIdentifier) {
        console.error("Cannot resume: No analysis identifier found.");
        setState(prev => ({...prev, error: "无法继续：未找到分析任务标识。", appStatus: AppOverallStatus.ERROR}));
        return;
    }

    isProcessingPausedRef.current = false;
    
    let nextStatus = AppOverallStatus.ANALYZING_CHUNKS;
    let chatInstance = state.currentChatInstance;

    if (state.analysisMode === 'opening' && !chatInstance && geminiAi) {
        try {
            chatInstance = startNovelAnalysisChat(geminiAi);
        } catch (e: any) {
            setState(prev => ({ ...prev, error: `恢复时无法启动 AI 对话: ${e.message}`, appStatus: AppOverallStatus.ERROR }));
            return;
        }
    }
    
    const newCurrentProcessingChunkOrder = state.lastSuccessfullyProcessedChunkOrder + 1;

    setState(prev => ({
        ...prev,
        appStatus: nextStatus,
        currentChatInstance: chatInstance, 
        currentProcessingChunkOrder: newCurrentProcessingChunkOrder,
        error: null 
    }));
    console.log("Analysis resumed from chunk " + newCurrentProcessingChunkOrder);
  }, [state.analysisIdentifier, state.analysisMode, state.currentChatInstance, state.lastSuccessfullyProcessedChunkOrder, geminiAi]);

  const handleCancel = useCallback(() => {
    handleReset(true); 
    console.log("Analysis cancelled and progress cleared.");
  }, [handleReset]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Effect for chunk processing queue
  useEffect(() => {
    if (state.appStatus === AppOverallStatus.ANALYZING_CHUNKS &&
        !isProcessingPausedRef.current &&
        state.totalChunksToProcess > 0 &&
        state.currentProcessingChunkOrder >= state.totalChunksToProcess &&
        activeRequestCountRef.current === 0
    ) {
        if (state.analysisMode === "opening") {
            setState(prev => ({ ...prev, appStatus: AppOverallStatus.GENERATING_OPENING_ASSESSMENT }));
        } else if (state.analysisMode === "full") {
            setState(prev => ({ ...prev, appStatus: AppOverallStatus.GENERATING_FULL_NOVEL_REPORT }));
        }
        return;
    }

    if (state.appStatus === AppOverallStatus.ANALYZING_CHUNKS && !isProcessingPausedRef.current) {
        const { analysisMode } = state;
        const maxConcurrent = analysisMode === "full" ? MAX_CONCURRENT_REQUESTS_FULL_MODE : 1;
        const delay = analysisMode === "opening" ? INTER_CHUNK_API_DELAY_MS_OPENING : INTER_CHUNK_API_DELAY_MS_FULL;

        if (activeRequestCountRef.current < maxConcurrent) {
            const nextChunkToProcessOrder = state.currentProcessingChunkOrder;
            if (nextChunkToProcessOrder < state.totalChunksToProcess) {
                const chunkState = state.chunks.find(c => c.order === nextChunkToProcessOrder)?.status;
                if (chunkState === ChunkStatus.PENDING_READ || chunkState === ChunkStatus.PENDING_ANALYSIS) {
                     readAndProcessNextChunk();
                } else if (nextChunkToProcessOrder <= state.lastSuccessfullyProcessedChunkOrder && chunkState === ChunkStatus.ANALYZED) {
                     setState(prev => ({ ...prev, currentProcessingChunkOrder: prev.currentProcessingChunkOrder + 1 }));
                } else if (chunkState === ChunkStatus.ERROR) {
                     setState(prev => ({ ...prev, currentProcessingChunkOrder: prev.currentProcessingChunkOrder + 1 }));
                }
            }
        }
        
        const timerId = setTimeout(() => {
             if (state.appStatus === AppOverallStatus.ANALYZING_CHUNKS && !isProcessingPausedRef.current && state.currentProcessingChunkOrder < state.totalChunksToProcess) {
                  setState(prev => ({...prev})); 
             }
        }, delay);
        return () => clearTimeout(timerId);
    }
  }, [state.appStatus, state.currentProcessingChunkOrder, state.totalChunksToProcess, state.chunks, state.analysisMode, readAndProcessNextChunk]);

  // Effect for estimating remaining time
  useEffect(() => {
    if (state.appStatus === AppOverallStatus.ANALYZING_CHUNKS && state.totalChunksToProcess > 0) {
      const remainingChunks = state.totalChunksToProcess - state.currentProcessingChunkOrder;
      if (remainingChunks <= 0) {
        setEstimatedTimeRemaining(null);
        return;
      }

      const concurrency = state.analysisMode === 'full' ? MAX_CONCURRENT_REQUESTS_FULL_MODE : 1;
      let estimatedSeconds;
      const processingTimes = chunkProcessingTimesRef.current;
      
      if (processingTimes.length >= 2) {
        const avgTimePerChunk = processingTimes.reduce((acc, time) => acc + time, 0) / processingTimes.length;
        estimatedSeconds = Math.round((remainingChunks * avgTimePerChunk) / 1000 / concurrency);
      } else { 
        const delayPerChunk = state.analysisMode === 'opening' ? INTER_CHUNK_API_DELAY_MS_OPENING : INTER_CHUNK_API_DELAY_MS_FULL;
        const initialApiTimeEstimate = 5000;
        const totalTimePerChunk = delayPerChunk + initialApiTimeEstimate;
        estimatedSeconds = Math.round((remainingChunks * totalTimePerChunk) / 1000 / concurrency);
      }

      if (estimatedSeconds > 0) {
        const minutes = Math.floor(estimatedSeconds / 60);
        const seconds = estimatedSeconds % 60;
        const paddedSeconds = seconds.toString().padStart(2, '0');
        
        if (minutes > 0) {
          setEstimatedTimeRemaining(`${minutes} 分 ${paddedSeconds} 秒`);
        } else {
          setEstimatedTimeRemaining(`${seconds} 秒`);
        }
      } else {
        setEstimatedTimeRemaining(null);
      }
    } else {
      setEstimatedTimeRemaining(null);
    }
  }, [state.appStatus, state.currentProcessingChunkOrder, state.totalChunksToProcess, state.analysisMode]);

  // Effect for final report generation
  useEffect(() => {
    if (state.appStatus === AppOverallStatus.GENERATING_OPENING_ASSESSMENT) {
      finalizeOpeningAssessment();
    } else if (state.appStatus === AppOverallStatus.GENERATING_FULL_NOVEL_REPORT) {
      finalizeFullReport();
    }
  }, [state.appStatus, finalizeOpeningAssessment, finalizeFullReport]);

  // Effect for saving progress
  useEffect(() => {
    if (state.analysisIdentifier && 
        (state.appStatus === AppOverallStatus.ANALYZING_CHUNKS || 
         state.appStatus === AppOverallStatus.PAUSED_AWAITING_RESUME) &&
        state.lastSuccessfullyProcessedChunkOrder >= 0) {
      saveProgressToLocalStorage(state);
    }
  }, [state.chunks, state.lastSuccessfullyProcessedChunkOrder, state.appStatus, state.analysisIdentifier, saveProgressToLocalStorage, state]);

  return {
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
  };
};