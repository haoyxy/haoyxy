import { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';

const USER_API_KEY_LOCALSTORAGE_KEY = 'userGeminiApiKeyOverride';

export const useGeminiClient = (initialGeminiAi: GoogleGenAI | null) => {
  const [currentAiClient, setCurrentAiClient] = useState<GoogleGenAI | null>(initialGeminiAi);

  useEffect(() => {
    setCurrentAiClient(initialGeminiAi);
    const userApiKey = localStorage.getItem(USER_API_KEY_LOCALSTORAGE_KEY);
    if (userApiKey) {
      try {
        const userAiClient = new GoogleGenAI({ apiKey: userApiKey });
        setCurrentAiClient(userAiClient);
        console.log("Initialized with user-provided API key from a previous session.");
      } catch (e) {
        console.error("Failed to initialize with stored user API key:", e);
        localStorage.removeItem(USER_API_KEY_LOCALSTORAGE_KEY);
      }
    }
  }, [initialGeminiAi]);

  const handleApiKeyOverride = useCallback(async (newKey: string): Promise<{ success: boolean; error?: string }> => {
    if (!newKey.trim()) {
      return { success: false, error: "API Key cannot be empty." };
    }
    try {
      const newClient = new GoogleGenAI({ apiKey: newKey });
      // Use a simple, low-cost model for a quick validation check
      await newClient.models.generateContent({model: 'gemini-2.5-flash', contents: 'test'});
      setCurrentAiClient(newClient);
      localStorage.setItem(USER_API_KEY_LOCALSTORAGE_KEY, newKey);
      console.log("Successfully switched to user-provided API key.");
      return { success: true };
    } catch (error: any) {
      console.error("Failed to validate or set new API key:", error);
      let message = "API Key 验证失败，请检查 Key 是否正确以及其权限。";
      if (error.message && (error.message.includes('API key not valid') || error.message.includes('403'))) {
        message = "API Key 无效或已过期，请检查并重试。";
      }
      return { success: false, error: message };
    }
  }, []);

  const resetClient = useCallback(() => {
    setCurrentAiClient(initialGeminiAi);
    localStorage.removeItem(USER_API_KEY_LOCALSTORAGE_KEY);
  }, [initialGeminiAi]);

  return { currentAiClient, handleApiKeyOverride, resetClient };
};