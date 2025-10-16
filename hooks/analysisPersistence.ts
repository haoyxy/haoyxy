import { PersistedProgressData, AppState, AnalysisMode, ExtractedEntity } from '../types';

const APP_PERSISTENCE_VERSION = "1.0.1";

export const saveProgressToLocalStorage = (currentAppState: AppState): void => {
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
      allKnownEntitiesArray: Array.from(currentAppState.allKnownEntities.entries()),
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
};

export const loadProgressFromLocalStorage = (identifier: string): PersistedProgressData | null => {
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
};

export const clearProgressFromLocalStorage = (identifier: string | null): void => {
  if (!identifier) return;
  try {
    localStorage.removeItem(`progress-${identifier}`);
    console.log(`Progress cleared for ${identifier}`);
  } catch (error) {
    console.error("Failed to clear progress from localStorage:", error);
  }
};