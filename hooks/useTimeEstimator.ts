import { useState, useRef, useEffect } from 'react';
import { AppState, AppOverallStatus } from '../types';
import { INTER_CHUNK_API_DELAY_MS_OPENING, INTER_CHUNK_API_DELAY_MS_FULL, MAX_CONCURRENT_REQUESTS_FULL_MODE } from '../constants';

export const useTimeEstimator = (state: AppState) => {
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string | null>(null);
  const chunkProcessingTimesRef = useRef<number[]>([]);

  const updateProcessingTime = (duration: number) => {
    chunkProcessingTimesRef.current.push(duration);
    if (chunkProcessingTimesRef.current.length > 10) {
      chunkProcessingTimesRef.current.shift();
    }
  };

  const resetEstimator = () => {
    setEstimatedTimeRemaining(null);
    chunkProcessingTimesRef.current = [];
  };

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
  
  return { estimatedTimeRemaining, updateProcessingTime, resetEstimator };
};
