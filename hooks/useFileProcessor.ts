import { useState, useRef, useCallback, useEffect } from 'react';
import { NovelChunk, ChunkStatus, AnalysisMode } from '../types';
import { CHUNK_SIZE, MAX_CHUNKS_FOR_OPENING_ANALYSIS } from '../constants';

const MAMMOTH_SCRIPT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js';

export interface FileProcessorCallbacks {
  onError: (errorMessage: string) => void;
  onChunkingStart: (actualTotalChunks: number, totalToProcess: number) => void;
  onFirstChunk: (chunk: NovelChunk) => void;
  onChunkBatch: (chunks: NovelChunk[]) => void;
  onCompleted: (actualTotalChunks: number, totalProcessed: number, encoding: string) => void;
}

export const useFileProcessor = (callbacks: FileProcessorCallbacks) => {
  const workerRef = useRef<Worker | null>(null);
  const [workerLogs, setWorkerLogs] = useState<string[]>([]);

  const killWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => killWorker();
  }, [killWorker]);

  const processFileInWorker = useCallback((
    file: File | null,
    textInput: string | null,
    analysisMode: AnalysisMode
  ) => {
    killWorker();
    setWorkerLogs([]);

    workerRef.current = new Worker(new URL('../public/fileProcessor.worker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (event) => {
      const { type, error, message } = event.data;
      
      const logMessage = `Worker: ${type} - ${message || error || `Received ${type} event`}`;
      setWorkerLogs(prevLogs => [...prevLogs, logMessage]);

      switch (type) {
        case 'error':
          callbacks.onError(error);
          killWorker();
          break;
        case 'chunking_started':
          callbacks.onChunkingStart(event.data.actualTotalChunksInFile, event.data.totalChunksToProcess);
          break;
        case 'first_chunk': {
          const { chunkBuffer, order } = event.data;
          const firstChunk: NovelChunk = {
            id: `chunk-${order}-${Date.now()}`,
            fileChunk: new Blob([chunkBuffer], { type: 'application/octet-stream' }),
            order: order,
            status: ChunkStatus.PENDING_READ,
          };
          callbacks.onFirstChunk(firstChunk);
          break;
        }
        case 'chunk_batch': {
          const { chunks: chunkDataBatch } = event.data;
          const newChunks: NovelChunk[] = chunkDataBatch.map((c: any) => ({
            id: `chunk-${c.order}-${Date.now()}`,
            fileChunk: new Blob([c.chunkBuffer], { type: 'application/octet-stream' }),
            order: c.order,
            status: ChunkStatus.PENDING_READ,
          }));
          callbacks.onChunkBatch(newChunks);
          break;
        }
        case 'completed':
          callbacks.onCompleted(event.data.actualTotalChunksInFile, event.data.totalChunksProcessed, event.data.usedEncoding);
          killWorker();
          break;
        case 'info':
        case 'warning':
          // Handled by logging above
          break;
      }
    };

    workerRef.current.onerror = (err) => {
      const errorMessage = `文件处理工作线程发生意外错误: ${err.message}`;
      setWorkerLogs(prevLogs => [...prevLogs, `Worker Error: ${err.message}`]);
      callbacks.onError(errorMessage);
      killWorker();
    };

    workerRef.current.postMessage({
      file: file,
      textInput: textInput,
      chunkSize: CHUNK_SIZE,
      mode: analysisMode,
      maxChunksForOpening: MAX_CHUNKS_FOR_OPENING_ANALYSIS,
      mammothUrl: MAMMOTH_SCRIPT_URL,
    });
  }, [callbacks, killWorker]);

  return { processFileInWorker, workerLogs, killWorker };
};
