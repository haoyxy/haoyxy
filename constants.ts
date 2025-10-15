
export const APP_NAME = "网文拆书匠 - AI小说深度分析"; // More general name
export const CHUNK_SIZE = 100 * 1024; // 0.1MB chunks (was 0.25MB)
export const GEMINI_TEXT_MODEL = 'gemini-2.5-flash';
export const MAX_RELEVANT_HISTORICAL_ENTITIES = 5; // Maximum number of historical entities to inject for context (primarily for opening)
export const MAX_CHUNKS_FOR_OPENING_ANALYSIS = 15; // Analyze roughly the first 1.5MB (15 chunks * 0.1MB/chunk) for opening quality. (Was 8 for 0.25MB chunks)
export const MAX_CONCURRENT_REQUESTS_FULL_MODE = 2; // Number of concurrent API requests for full novel analysis mode.
// FIX: Export delay constants to be shared across components and hooks.
export const INTER_CHUNK_API_DELAY_MS_OPENING = 3000;
export const INTER_CHUNK_API_DELAY_MS_FULL = 5000;
