import { Chat } from "@google/genai";

export type AnalysisMode = "opening" | "full" | "viability" | "chapter";

export interface NovelChunk {
  id: string;
  fileChunk: Blob; // Blob created from ArrayBuffer sent by worker
  order: number; 
  textContent?: string; // Still used temporarily for analysis, then cleared
  analysis?: string; // Analysis for this specific chunk
  summary?: string; // Summary for this specific chunk
  status: ChunkStatus;
  error?: string;
}

export enum ChunkStatus {
  PENDING_READ = "PENDING_READ", // Main thread reads text from Blob
  READING = "READING",
  PENDING_ANALYSIS = "PENDING_ANALYSIS",
  ANALYZING = "ANALYZING",
  ANALYZED = "ANALYZED",
  ERROR = "ERROR",
}

export interface ViabilityReport {
  noveltyScore: number;
  noveltyAnalysis: string;
  marketFitAnalysis: {
    recommendedGenres: string[];
    targetAudience: string;
    marketPotential: string;
  };
  poisonPillWarning: {
    warnings: Array<{
      type: string;
      description: string;
      severity: "High" | "Medium" | "Low";
    }>;
    summary: string;
  };
  overallAssessment: string;
}

export interface ChapterReport {
  effectivePlotProgressionRate: number; // 0-100
  progressionAnalysis: string;
  informationDensityIndex: number; // 1-10
  densityAnalysis: string;
  conflictClimaxDensity: number; // count
  conflictAnalysis: string;
  hookStrengthRating: "High" | "Medium" | "Low";
  hookAnalysis: string;
  overallAssessment: string;
}


export interface AppState {
  analysisMode: AnalysisMode | null;
  file: File | null; 
  fileName: string | null;
  chunks: NovelChunk[];
  currentChatInstance: Chat | null;
  openingAssessment: string | null; 
  fullNovelReport: string | null; 
  viabilityReport: ViabilityReport | null;
  chapterReport: ChapterReport | null;
  appStatus: AppOverallStatus;
  error: string | null;
  currentProcessingChunkOrder: number; 
  totalChunksToProcess: number; 
  actualTotalChunksInFile: number; 
  knowledgeBase: Map<string, { firstMentionOrder: number; summaryOfFirstMention: string }>;
  allKnownEntities: Set<string>;
  analysisIdentifier: string | null; // Unique ID for the current analysis task (filename/hash + mode)
  lastSuccessfullyProcessedChunkOrder: number; // To track resume point
}

export enum AppOverallStatus {
  IDLE = "IDLE",
  MODE_SELECTED = "MODE_SELECTED",
  AWAITING_VIABILITY_BRIEF = "AWAITING_VIABILITY_BRIEF",
  ANALYZING_VIABILITY = "ANALYZING_VIABILITY",
  VIABILITY_ANALYSIS_COMPLETED = "VIABILITY_ANALYSIS_COMPLETED",
  AWAITING_CHAPTER_INPUT = "AWAITING_CHAPTER_INPUT",
  ANALYZING_CHAPTER = "ANALYZING_CHAPTER",
  CHAPTER_ANALYSIS_COMPLETED = "CHAPTER_ANALYSIS_COMPLETED",
  FILE_SELECTED = "FILE_SELECTED", 
  READING_CHUNKS = "READING_CHUNKS", 
  ANALYZING_CHUNKS = "ANALYZING_CHUNKS",
  GENERATING_OPENING_ASSESSMENT = "GENERATING_OPENING_ASSESSMENT",
  OPENING_ANALYSIS_COMPLETED = "OPENING_ANALYSIS_COMPLETED",
  GENERATING_FULL_NOVEL_REPORT = "GENERATING_FULL_NOVEL_REPORT",
  FULL_NOVEL_ANALYSIS_COMPLETED = "FULL_NOVEL_ANALYSIS_COMPLETED",
  CANCELLED = "CANCELLED", 
  PAUSED_AWAITING_RESUME = "PAUSED_AWAITING_RESUME", // For when analysis is paused, progress saved.
  ERROR = "ERROR",
}

export interface ChunkAnalysisResponse {
  summary: string;
  analysis: string;
  extractedEntities?: string[];
}

// Data structure for saving progress to localStorage
export interface PersistedProgressData {
  appVersion: string; // To handle potential future data structure changes
  analysisIdentifier: string;
  analysisMode: AnalysisMode;
  fileName: string; // Or a placeholder for pasted text
  chunks: Array<Pick<NovelChunk, 'id' | 'order' | 'analysis' | 'summary' | 'status' | 'error'>>; // Only save essential chunk data
  openingAssessment: string | null;
  fullNovelReport: string | null;
  knowledgeBaseEntries: Array<[string, { firstMentionOrder: number; summaryOfFirstMention: string }]>; // For Map
  allKnownEntitiesArray: string[]; // For Set
  lastSuccessfullyProcessedChunkOrder: number;
  totalChunksToProcess: number;
  actualTotalChunksInFile: number;
  timestamp: number;
}