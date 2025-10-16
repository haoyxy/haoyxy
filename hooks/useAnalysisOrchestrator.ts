import { useRef, useEffect, useCallback } from 'react';
import { AppState, AppOverallStatus, ChunkStatus, ChunkAnalysisResponse, ExtractedEntity } from '../types';
import { GoogleGenAI } from '@google/genai';
import { 
  analyzeNovelChunkInChat, 
  concludeOpeningAssessmentInChat,
  analyzeNovelChunkForFullMode,
  concludeFullNovelReportInChat
} from '../public/services/geminiService';
import { MAX_RELEVANT_HISTORICAL_ENTITIES, MAX_CONCURRENT_REQUESTS_FULL_MODE, INTER_CHUNK_API_DELAY_MS_OPENING, INTER_CHUNK_API_DELAY_MS_FULL, CHUNK_SIZE } from '../constants';
import * as Persistence from './analysisPersistence';

export const useAnalysisOrchestrator = (
  state: AppState,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  geminiClient: GoogleGenAI | null,
  updateProcessingTime: (duration: number) => void
) => {
  const isProcessingPausedRef = useRef(false);
  const activeRequestCountRef = useRef(0);
  const abortControllersRef = useRef<AbortController[]>([]);

  const pauseProcessing = useCallback(() => {
    isProcessingPausedRef.current = true;
  }, []);
  
  const resumeProcessing = useCallback(() => {
    isProcessingPausedRef.current = false;
  }, []);

  const abortAllRequests = useCallback(() => {
    abortControllersRef.current.forEach(controller => controller.abort("User cancelled"));
    abortControllersRef.current = [];
    activeRequestCountRef.current = 0;
  }, []);

  const readAndProcessNextChunk = useCallback(async () => {
    if (isProcessingPausedRef.current || !geminiClient) return;

    const { chunks, currentProcessingChunkOrder, totalChunksToProcess, analysisMode } = state;
    
    if (currentProcessingChunkOrder >= totalChunksToProcess) return;

    const chunkToProcess = chunks.find(c => c.order === currentProcessingChunkOrder);
    if (!chunkToProcess || chunkToProcess.status === ChunkStatus.ANALYZED) {
      if(chunkToProcess) { // If already analyzed, just skip
         setState(prev => ({ ...prev, currentProcessingChunkOrder: prev.currentProcessingChunkOrder + 1 }));
      }
      return;
    }

    let textContent = '';
    try {
      let blobToRead = chunkToProcess.fileChunk;
      if (blobToRead.size === 0 && state.file) { // Rehydration logic
        const start = chunkToProcess.order * CHUNK_SIZE;
        const end = start + CHUNK_SIZE;
        blobToRead = state.file.slice(start, end);
      }
      if (blobToRead.size > 0) {
        setState(prev => ({ ...prev, chunks: prev.chunks.map(c => c.id === chunkToProcess.id ? { ...c, status: ChunkStatus.READING, fileChunk: blobToRead } : c) }));
        textContent = await new TextDecoder('utf-8').decode(await blobToRead.arrayBuffer());
      } else {
        throw new Error("块内容为空");
      }
    } catch (readError: any) {
      setState(prev => ({...prev, chunks: prev.chunks.map(c => c.id === chunkToProcess.id ? { ...c, status: ChunkStatus.ERROR, error: `读取失败: ${readError.message}` } : c), currentProcessingChunkOrder: prev.currentProcessingChunkOrder + 1 }));
      return;
    }
    
    setState(prev => ({ ...prev, chunks: prev.chunks.map(c => c.id === chunkToProcess.id ? { ...c, status: ChunkStatus.ANALYZING } : c) }));

    const abortController = new AbortController();
    abortControllersRef.current.push(abortController);
    activeRequestCountRef.current++;

    const startTime = Date.now();
    try {
      let analysisResult: ChunkAnalysisResponse;

      if (analysisMode === "opening") {
        if (!state.currentChatInstance) throw new Error("AI 对话实例未初始化。");
        const previousChunk = state.chunks.find(c => c.order === chunkToProcess.order - 1);
        let relevantHistoricalContext = "";
        if (chunkToProcess.order > 0 && state.allKnownEntities.size > 0) {
            const recentMentions = state.chunks
                .filter(c => c.order < chunkToProcess.order && c.status === ChunkStatus.ANALYZED && c.summary)
                .slice(-MAX_RELEVANT_HISTORICAL_ENTITIES)
                .map(c => `先前片段 ${c.order + 1} 摘要: "${c.summary}"`);
            if (recentMentions.length > 0) relevantHistoricalContext = "为帮助理解当前内容，以下是先前内容相关的摘要回顾：\n" + recentMentions.join("\n");
        }
        analysisResult = await analyzeNovelChunkInChat(state.currentChatInstance, textContent, chunkToProcess.order + 1, totalChunksToProcess, previousChunk?.summary, relevantHistoricalContext);
      } else if (analysisMode === "full") {
        const previousChunk = state.chunks.find(c => c.order === chunkToProcess.order - 1);
        analysisResult = await analyzeNovelChunkForFullMode(geminiClient, textContent, chunkToProcess.order + 1, totalChunksToProcess, previousChunk?.summary);
      } else {
        throw new Error(`未知的分析模式 "${analysisMode}"`);
      }

      const newAllKnownEntities = new Map<string, ExtractedEntity>(state.allKnownEntities);
      (analysisResult.extractedEntities || []).forEach(entity => {
        if (entity && entity.name && entity.type && entity.context) {
            newAllKnownEntities.set(entity.name, entity);
        }
      });

      setState(prev => ({
        ...prev,
        chunks: prev.chunks.map(c => c.id === chunkToProcess.id ? { ...c, ...analysisResult, status: ChunkStatus.ANALYZED } : c),
        allKnownEntities: newAllKnownEntities,
        lastSuccessfullyProcessedChunkOrder: chunkToProcess.order,
        currentProcessingChunkOrder: prev.currentProcessingChunkOrder + 1,
        error: null,
      }));
    } catch (err: any) {
      if (err.isAuthError) {
          setState(prev => ({ ...prev, appStatus: AppOverallStatus.ERROR, error: `API Key 认证失败，请检查 Key 的有效性。(${err.message})`}));
          abortAllRequests();
          pauseProcessing();
      } else if (err.isRateLimitError) {
        pauseProcessing();
        setState(prev => ({...prev, appStatus: AppOverallStatus.PAUSED_RATE_LIMITED, chunks: prev.chunks.map(c => c.id === chunkToProcess.id ? { ...c, status: ChunkStatus.PENDING_ANALYSIS } : c), error: `处理分块 ${chunkToProcess.order + 1} 时达到 API 限制。分析已暂停。`}));
      } else {
        setState(prev => ({ ...prev, chunks: prev.chunks.map(c => c.id === chunkToProcess.id ? { ...c, status: ChunkStatus.ERROR, error: err.message } : c), currentProcessingChunkOrder: prev.currentProcessingChunkOrder + 1, error: `AI分析分块 ${chunkToProcess.order + 1} 失败: ${err.message}` }));
      }
    } finally {
      updateProcessingTime(Date.now() - startTime);
      activeRequestCountRef.current--;
      abortControllersRef.current = abortControllersRef.current.filter(c => c !== abortController);
    }
  }, [state, setState, geminiClient, pauseProcessing, updateProcessingTime, abortAllRequests]);

  const finalizeAnalysis = useCallback(async () => {
    if (!geminiClient) return;
    
    pauseProcessing();
    const { analysisMode, chunks, totalChunksToProcess, fileName, actualTotalChunksInFile } = state;
    
    try {
      if (analysisMode === 'opening') {
        const analyzedSummaries = chunks.filter(c => c.status === ChunkStatus.ANALYZED && c.summary).sort((a, b) => a.order - b.order).map(c => `分块 ${c.order + 1} 摘要：\n${c.summary}`).join('\n\n');
        if (!analyzedSummaries) throw new Error("未能分析任何有效分块");
        const assessment = await concludeOpeningAssessmentInChat(geminiClient, chunks.filter(c => c.status === ChunkStatus.ANALYZED).length, analyzedSummaries);
        setState(prev => ({ ...prev, openingAssessment: assessment, appStatus: AppOverallStatus.OPENING_ANALYSIS_COMPLETED }));
      } else if (analysisMode === 'full') {
        const allSummaries = chunks.filter(c => c.status === ChunkStatus.ANALYZED && c.summary).sort((a, b) => a.order - b.order).map(c => `分块 ${c.order + 1} 摘要：\n${c.summary}`).join('\n\n');
        if (!allSummaries) throw new Error("未能分析任何有效分块");
        const report = await concludeFullNovelReportInChat(geminiClient, fileName || "未知小说", chunks.filter(c => c.status === ChunkStatus.ANALYZED).length, allSummaries);
        setState(prev => ({ ...prev, fullNovelReport: report, appStatus: AppOverallStatus.FULL_NOVEL_ANALYSIS_COMPLETED }));
      }
      Persistence.clearProgressFromLocalStorage(state.analysisIdentifier);
    } catch (err: any) {
      setState(prev => ({ ...prev, error: `生成最终报告失败: ${err.message}`, appStatus: AppOverallStatus.ERROR }));
    } finally {
      resumeProcessing(); // Not strictly needed, but good practice
    }
  }, [geminiClient, state, setState, pauseProcessing, resumeProcessing]);

  useEffect(() => {
    if (state.appStatus === AppOverallStatus.ANALYZING_CHUNKS && !isProcessingPausedRef.current && state.currentProcessingChunkOrder >= state.totalChunksToProcess && activeRequestCountRef.current === 0) {
      const nextStatus = state.analysisMode === "opening" ? AppOverallStatus.GENERATING_OPENING_ASSESSMENT : AppOverallStatus.GENERATING_FULL_NOVEL_REPORT;
      setState(prev => ({ ...prev, appStatus: nextStatus }));
      return;
    }

    const manageQueue = () => {
      if (state.appStatus === AppOverallStatus.ANALYZING_CHUNKS && !isProcessingPausedRef.current) {
        const maxConcurrent = state.analysisMode === "full" ? MAX_CONCURRENT_REQUESTS_FULL_MODE : 1;
        while (activeRequestCountRef.current < maxConcurrent && state.currentProcessingChunkOrder + activeRequestCountRef.current < state.totalChunksToProcess) {
          const nextChunkOrder = state.currentProcessingChunkOrder + activeRequestCountRef.current;
          const chunk = state.chunks.find(c => c.order === nextChunkOrder);
          if (chunk && (chunk.status === ChunkStatus.PENDING_READ || chunk.status === ChunkStatus.PENDING_ANALYSIS)) {
            readAndProcessNextChunk();
          } else if (!chunk) {
             break; // We've run out of chunks to process for now
          } else {
              // This chunk is already processing or done, let the loop continue
          }
        }
      }
    };
    
    const delay = state.analysisMode === "opening" ? INTER_CHUNK_API_DELAY_MS_OPENING : INTER_CHUNK_API_DELAY_MS_FULL;
    const intervalId = setInterval(manageQueue, delay / 2); // Check queue periodically
    
    return () => clearInterval(intervalId);

  }, [state.appStatus, state.currentProcessingChunkOrder, state.totalChunksToProcess, state.chunks, state.analysisMode, readAndProcessNextChunk, setState]);

  useEffect(() => {
    if (state.appStatus === AppOverallStatus.GENERATING_OPENING_ASSESSMENT || state.appStatus === AppOverallStatus.GENERATING_FULL_NOVEL_REPORT) {
      finalizeAnalysis();
    }
  }, [state.appStatus, finalizeAnalysis]);

  return { pauseProcessing, resumeProcessing, abortAllRequests };
};