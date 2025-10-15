import { GoogleGenAI, Chat, GenerateContentResponse, Content, Type } from "@google/genai";
import { ChunkAnalysisResponse, ViabilityReport, ChapterReport } from '../../types';
import { GEMINI_TEXT_MODEL as APP_GEMINI_MODEL, MAX_CHUNKS_FOR_OPENING_ANALYSIS } from '../../constants';

const callGeminiWithRetry = async (
  apiCall: () => Promise<GenerateContentResponse>,
  maxRetries: number = 3, // Max retries after the initial attempt
  initialDelayMs: number = 2000, // Initial delay before the first retry
  backoffFactor: number = 2
): Promise<GenerateContentResponse> => {
  let attempt = 0; // Number of retries attempted
  let currentDelay = initialDelayMs;

  while (true) {
    let isRateLimitError = false; // Initialize here for each attempt cycle
    let detailedErrorMessage: string = 'Unknown API error during callGeminiWithRetry'; // Declare and initialize

    try {
      return await apiCall();
    } catch (error: any) {
      detailedErrorMessage = error.message || 'Unknown API error after catch';

      if (typeof error.message === 'string') {
        try {
          const parsedError = JSON.parse(error.message);
          if (parsedError.error) {
            detailedErrorMessage = parsedError.error.message || detailedErrorMessage;
            if (parsedError.error.code === 429 || parsedError.error.status === 'RESOURCE_EXHAUSTED' || parsedError.error.status === 'RATE_LIMIT_EXCEEDED') {
              isRateLimitError = true;
            }
          }
        } catch (e) {
          // Not a JSON string, or parsing failed. detailedErrorMessage remains error.message or the default.
        }
      }
      
      // Fallback check on error object properties (if error.message wasn't a parsable JSON string containing the info)
      if (!isRateLimitError && error.code === 429) { 
          isRateLimitError = true;
      }
      if (!isRateLimitError && typeof error.status === 'string' && (error.status.toUpperCase() === 'RESOURCE_EXHAUSTED' || error.status.toUpperCase() === 'RATE_LIMIT_EXCEEDED')) {
          isRateLimitError = true;
      }


      if (isRateLimitError && attempt < maxRetries) {
        attempt++;
        const jitter = Math.random() * 1000; // Add up to 1s jitter
        const delayWithJitter = currentDelay + jitter;
        console.warn(`Rate limit error encountered (Attempt ${attempt}/${maxRetries} to retry). Retrying in ~${Math.round(delayWithJitter / 1000)}s. Error: ${detailedErrorMessage}`);
        await new Promise(resolve => setTimeout(resolve, delayWithJitter));
        currentDelay *= backoffFactor;
      } else {
        let finalErrorMessageText = detailedErrorMessage;
        if (isRateLimitError && attempt >= maxRetries) {
            finalErrorMessageText = `API call failed after ${attempt} retries due to persistent rate limiting. Final error: ${detailedErrorMessage}`;
            console.error(finalErrorMessageText, error);
        } else {
            console.error(`API call failed. Error: ${detailedErrorMessage}`, error);
        }
        const finalError = new Error(finalErrorMessageText);
        (finalError as any).isRateLimitError = isRateLimitError; // Attach the flag
        throw finalError;
      }
    }
  }
};


interface ParseSuccess<T> {
  success: true;
  data: T;
}
interface ParseFailure {
  success: false;
  error: string;
  rawText: string;
}
type ParseResult<T> = ParseSuccess<T> | ParseFailure;

const parseJsonResponse = <T extends object>(responseText: string): ParseResult<T> => {
  let jsonStr = responseText.trim();
  if (!jsonStr) {
    return { success: false, error: 'AI returned an empty response.', rawText: responseText };
  }

  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[1]) {
    jsonStr = match[1].trim();
  }

  try {
    const parsedData = JSON.parse(jsonStr);
    if (typeof parsedData === 'object' && parsedData !== null && !Array.isArray(parsedData)) {
      return { success: true, data: parsedData as T };
    } else {
      return { success: false, error: `Parsed JSON is not a valid object. Type: ${Array.isArray(parsedData) ? 'array' : typeof parsedData}`, rawText: responseText };
    }
  } catch (e: any) {
    // If initial parsing fails, try to repair and re-parse. This is a common issue with LLM-generated JSON
    // that contains unescaped control characters (like newlines) in string values.
    console.warn("Initial JSON parsing failed, attempting to repair unescaped newlines...", e.message);
    try {
      let repaired = '';
      let inString = false;
      for (let i = 0; i < jsonStr.length; i++) {
        const char = jsonStr[i];

        if (char === '"') {
          // Check if this quote is escaped by counting preceding backslashes
          let backslashCount = 0;
          while (i - 1 - backslashCount >= 0 && jsonStr[i - 1 - backslashCount] === '\\') {
            backslashCount++;
          }
          // If the number of preceding backslashes is even, this quote is a real delimiter
          if (backslashCount % 2 === 0) {
            inString = !inString;
          }
        }

        // If we are inside a string and find a newline or other problematic control characters, escape them.
        if (inString) {
          if (char === '\n') {
            repaired += '\\n';
            continue;
          }
          if (char === '\r') {
            repaired += '\\r';
            continue;
          }
           if (char === '\t') {
            repaired += '\\t';
            continue;
          }
        }
        
        repaired += char;
      }

      const parsedData = JSON.parse(repaired);
      if (typeof parsedData === 'object' && parsedData !== null && !Array.isArray(parsedData)) {
        console.warn("Successfully parsed JSON after repairing control characters.");
        return { success: true, data: parsedData as T };
      } else {
        return { success: false, error: `Repaired JSON is not a valid object. Type: ${Array.isArray(parsedData) ? 'array' : typeof parsedData}`, rawText: responseText };
      }
    } catch (repairError: any) {
      // If repair also fails, we fall back to the original, more comprehensive error.
      return { success: false, error: `Failed to parse JSON. Original error: ${e.message}. After-repair error: ${repairError.message}`, rawText: responseText };
    }
  }
};


// --- Opening Analysis Functions ---

export const startNovelAnalysisChat = (ai: GoogleGenAI): Chat => {
  try {
    return ai.chats.create({
      model: APP_GEMINI_MODEL,
      config: {
        systemInstruction: `你是一位专门分析网络小说开篇部分的顶尖专家，尤其擅长运用“黄金三章”理论来评估作品的初期吸引力和潜力。
你的核心任务是：深入剖析小说开头约 ${MAX_CHUNKS_FOR_OPENING_ANALYSIS} 个内容分块（通常对应小说前几章或数万字内容），判断其能否在最短时间内抓住读者，并为后续故事打下坚实基础。

分析原则：
1.  **读者第一视角**：模拟真实读者，特别是网文老饕的阅读体验和期待。
2.  **“黄金三章”核心**：严格审视每一分块是否符合“黄金三章”的经典要求，例如是否有效设立悬念、引入核心冲突、塑造主角魅力、明确主要矛盾。
3.  **批判性与建设性**：不仅要识别亮点，更要精准指出不足。你的分析应具有洞察力，并对寻求改进开篇的作者具有实际指导意义。
4.  **卖点挖掘**：识别并评估小说开篇所展现的核心“卖点”（如独特的设定、引人入胜的情节钩子、鲜明的角色、创新的世界观等）。

你将按顺序接收小说的前 ${MAX_CHUNKS_FOR_OPENING_ANALYSIS} 个分块。
对于每个分块，你需要：
- 提供一个简洁凝练的摘要（2-4句话），准确捕捉该分块的核心事件和信息。
- 提供一份详细的批判性分析，聚焦于该分块对小说开篇的贡献与影响。明确指出其优点（如如何吸引读者、如何铺垫后续等）和可以改进之处（如节奏问题、信息模糊、吸引力不足等）。
- 提取当前分块内容中出现的、对理解开篇剧情至关重要的“关键实体”。这些实体应主要为专有名词，例如：重要角色名（主角、重要配角、反派）、有辨识度的地点名、独特的物品或功法技能名、组织派系名，以及本分块引入的、尚未解决的核心谜团或关键冲突线索。

严格遵守JSON输出格式。你的回应必须是一个有效的、可以直接解析的 JSON 对象。在 JSON 的字符串值中，请确保所有特殊字符都已正确转义（例如，换行符表示为 \\n，双引号表示为 \\"，反斜杠表示为 \\\\）。JSON 结构必须如下：
{"summary": "...", "analysis": "...", "extractedEntities": ["实体1", "实体2"]}`,
        responseMimeType: "application/json",
      },
    });
  } catch (error: any) {
    console.error("Failed to start Gemini chat session:", error);
    const customError = new Error(`创建AI对话实例失败: ${error.message}`);
    (customError as any).isRateLimitError = false;
    throw customError;
  }
};

export const analyzeNovelChunkInChat = async ( 
  chat: Chat,
  chunkContent: string,
  chunkNumber: number, 
  totalChunksToAnalyze: number, 
  previousChunkSummary?: string | null,
  relevantHistoricalContext?: string | null
): Promise<ChunkAnalysisResponse> => {
  try {
    let prompt = `这是小说开篇部分 ${totalChunksToAnalyze} 个分块中的第 ${chunkNumber} 个。请专注于评估此分块对小说开局的贡献。`;
    if (previousChunkSummary && chunkNumber > 1) prompt += `\n\n前情提要（上一个开篇分块的摘要）：\n${previousChunkSummary}\n`;
    if (relevantHistoricalContext) prompt += `\n\n${relevantHistoricalContext}\n`;
    
    prompt += `\n\n请在“analysis”中详述以下针对小说开篇的关键要素，并评价其优缺点，尽可能提供具体文本证据支持你的观点：
1.  **“黄金三章”贡献度**: 根据当前是第 ${chunkNumber} 块，评估其在设立核心冲突、介绍关键角色（尤其是主角）、构建初期悬念、展现小说核心卖点等方面的效果。
2.  **情节节奏与结构**: 节奏是否紧凑抓人，还是拖沓冗余？事件安排是否逻辑清晰，引人入胜？信息密度是否合适？
3.  **角色塑造（开篇阶段）**: 主角形象是否鲜明、有吸引力？其动机、目标、困境是否清晰呈现？配角是否有记忆点，是否有效服务于主角或情节？
4.  **文笔与叙事**: 语言风格是否与题材匹配？叙事是否流畅自然？描写是否生动形象，能否有效调动读者情绪？对话是否符合人物身份？
5.  **创新性与套路（开篇阶段）**: 有无令人耳目一新的设定、情节或角色类型？是否巧妙地运用或规避了常见网文套路？
6.  **开篇吸引力要素**: 是否成功营造了强烈的代入感、好奇心、期待感或危机感？有无明确的“爽点”或“钩子”？
7.  **(若有历史背景回顾)** **开篇历史关联**：当前分块内容与早期提及实体的关联性及其对剧情的推动效果，是否自然且有意义？

请提取当前分块内容中出现的、对理解后续开篇剧情发展至关重要的“关键实体”。这些实体应主要为专有名词，例如：重要角色名、有辨识度的地点名、独特的物品或功法技能名、组织派系名，以及本分块引入的、尚未解决的核心谜团或关键冲突线索。

请记住，回应必须是严格符合规范的 JSON 格式。在 JSON 的字符串值中，确保正确转义特殊字符（例如换行符为 \\n，双引号为 \\"，反斜杠为 \\\\）。JSON 结构：{"summary": "...", "analysis": "...", "extractedEntities": ["实体1", "实体2"]}\n\n--- 分块内容开始 ---\n${chunkContent}\n--- 分块内容结束 ---`;
    
    const response = await callGeminiWithRetry(
        () => chat.sendMessage({ message: prompt })
    );

    if (!response.candidates || response.candidates.length === 0 || !response.text) {
        const finishReason = response.candidates?.[0]?.finishReason;
        const safetyRatings = response.candidates?.[0]?.safetyRatings;
        let detail = `The AI model returned no content.`;
        if (finishReason) {
            detail += ` Finish reason: ${finishReason}.`;
        }
        if (safetyRatings) {
            detail += ` Safety ratings: ${JSON.stringify(safetyRatings, null, 2)}.`;
        }
        const error = new Error(`AI 对分块 ${chunkNumber} 的回应为空。${detail}`);
        (error as any).isRateLimitError = false; 
        throw error;
    }

    const parsedResult = parseJsonResponse<ChunkAnalysisResponse>(response.text);

    if (parsedResult.success === false) {
      const error = new Error(`无法解析AI对开篇分块 ${chunkNumber} 的回应: ${parsedResult.error} 原始回应: "${parsedResult.rawText}"`);
      (error as any).isRateLimitError = false; 
      throw error;
    }

    const data = parsedResult.data;
    if (typeof data.summary !== 'string' || typeof data.analysis !== 'string') {
      const error = new Error(`AI对开篇分块 ${chunkNumber} 的回应缺少必需的 'summary' 或 'analysis' 字段. 原始回应: ${response.text}`);
      (error as any).isRateLimitError = false; 
      throw error;
    }
      
    if (!data.extractedEntities || !Array.isArray(data.extractedEntities)) {
      data.extractedEntities = [];
    }
    return data;
  } catch (error: any) {
    console.error(`分析开篇分块 ${chunkNumber} 时出错:`, error.message);
    if (error.isRateLimitError === undefined) {
        const newError = new Error(`分析开篇分块 ${chunkNumber} 时发生内部错误：${error?.message}`);
        (newError as any).isRateLimitError = false;
        throw newError;
    }
    throw error;
  }
};

export const concludeOpeningAssessmentInChat = async ( 
  ai: GoogleGenAI,
  totalAnalyzedChunks: number, 
  analyzedOpeningChunkSummaries: string 
): Promise<string> => {
  const assessmentChat = ai.chats.create({ 
    model: APP_GEMINI_MODEL,
    config: {
      systemInstruction: `你是一位顶尖的网络小说评论家与资深编辑，以犀利、精准、富有洞察力著称。你的任务是基于提供的小说开篇各分块摘要，撰写一份全面、深入、结构清晰的【小说开篇综合评估报告】。
请专注于从宏观角度评价开篇的整体表现，提供具有专业水准的分析。确保报告流畅、有见地、论证充分且具有批判性。此报告应直接面向希望了解作品开篇质量的读者或寻求改进的作者。`,
    },
  });

  try {
    const prompt = `小说的前 ${totalAnalyzedChunks} 个关键开篇分块均已处理和分析完毕。
以下是这些开篇分块的摘要回顾，它们共同构成了小说的开篇部分：
--- 已分析开篇分块摘要开始 ---
${analyzedOpeningChunkSummaries}
--- 已分析开篇分块摘要结束 ---

这份最终输出不应是 JSON 格式，而应是一份结构清晰、有理有据的【小说开篇综合评估报告】。
请务必深入讨论以下方面，并给出明确的评价和理由，尽可能结合摘要内容进行例证：

1.  **“黄金三章”执行情况总结**：综合评价开篇部分是否成功实现了“黄金三章”（或类似开篇理论）的核心目标。例如：
    *   是否迅速引入了核心冲突与主要矛盾？
    *   主角形象是否快速树立，并展现其核心特质与动机？
    *   是否成功建立了引人入胜的悬念或期待？
    *   小说的核心卖点（如世界观、金手指、情感纠葛等）是否得到清晰有效的展示？

2.  **开篇核心吸引力 (The Hook)**：用一两句话概括这部小说开篇最核心的钩子是什么。评估这个钩子的吸引力强度、呈现方式（是直接还是间接，是快速还是慢热）及其在抓住目标读者方面的预期效果。

3.  **主角塑造与代入感（开篇阶段）**：
    *   主角的形象是否立体鲜明？性格特点是否突出且具有吸引力？
    *   主角的目标、欲望、面临的困境或挑战是否清晰？
    *   读者能否快速对主角产生代入感、共鸣或强烈的关注？原因是什么？

4.  **世界观与核心设定（开篇阶段）**：
    *   开篇所展示的世界观背景和核心设定（如力量体系、社会规则、独特元素等）是否新颖、有趣、易于理解？
    *   这些设定是否有效地服务于开篇情节，并为后续故事发展提供了足够的想象空间和潜力？

5.  **叙事节奏与结构（开篇阶段）**：
    *   开篇的整体节奏是快是慢？是否张弛有度？信息密度是否合适（过多导致难以消化，过少导致枯燥）？
    *   情节推进是否顺畅自然，逻辑是否严密？有无明显的拖沓、跳跃或逻辑断裂之处？

6.  **开篇的显著优点**：列举并详细阐述开篇部分最值得称道的2-3个方面。这些可以是情节设计、角色魅力、设定创新、文笔表现等。

7.  **开篇的明显缺点/潜在风险**：指出开篇部分存在的2-3个主要问题，或可能导致读者流失的风险点。请具体分析原因。

8.  **开篇质量层级初步判定及目标读者**：
    *   综合判断开篇的质量等级（例如：神级开局、惊艳亮眼、平稳合格、略有瑕疵、问题较多、开局不利）。详细阐述你的判定理由。
    *   根据开篇的风格、题材和内容特点，分析其最可能吸引哪些类型的读者群体？

9.  **读者留存预测及建设性建议**：
    *   基于当前开篇质量，预测读者在阅读完这部分内容后的留存可能性（高、中、低）。
    *   如果存在明显的流失风险或不足之处，请针对性地提出2-3条具体的、可操作的改进建议，帮助作者提升开篇吸引力。

请提供一份连贯、有见地、详细且批判性强的开篇评估报告。语言风格应专业、客观且易于读者（包括作者）理解。`;
    
    const response = await callGeminiWithRetry(
        () => assessmentChat.sendMessage({ message: prompt })
    );
    return response.text;
  } catch (error: any) {
    console.error("总结小说开篇评估时出错:", error.message);
    if (error.isRateLimitError === undefined) {
        const newError = new Error(`生成小说开篇评估时发生内部错误：${error?.message}`);
        (newError as any).isRateLimitError = false;
        throw newError;
    }
    throw error;
  }
};

export const analyzeNovelChunkForFullMode = async ( 
  ai: GoogleGenAI,
  chunkContent: string,
  chunkNumber: number, 
  totalChunksInNovel: number, 
  previousChunkSummary?: string | null
): Promise<ChunkAnalysisResponse> => {
  const systemInstructionForFullChunk = `你是一位资深文学评论家和小说分析专家，擅长对长篇网络小说进行全面而深入的解构。
你的核心任务是：按顺序接收并分析小说的所有内容分块，为最终的整书综合报告提供素材。你的分析需要客观、精准、并关注细节。
对于当前提供的分块：
- 提供一个该分块的简洁但信息丰富的摘要（3-5句话），准确捕捉核心事件、关键信息和主要进展。
- 提供一份对该分块主要内容、情节进展、角色表现和重要设定的客观分析，侧重于其在整体叙事中的作用和意义。
- 提取该分块中出现的、对理解小说整体情节或追踪关键元素发展至关重要的“关键实体”。

你的回应必须是一个有效的、可以直接解析的 JSON 对象。在 JSON 的字符串值中，请确保所有特殊字符都已正确转义（例如，换行符应表示为 \\n，双引号应表示为 \\"，反斜杠应表示为 \\\\）。JSON 结构必须如下：
{"summary": "...", "analysis": "...", "extractedEntities": ["实体A", "事件B"]}`;

  try {
    let userMessage = `这是小说全本（共 ${totalChunksInNovel} 个分块）中的第 ${chunkNumber} 个分块。请对此分块内容进行摘要和分析。`;
    if (previousChunkSummary && chunkNumber > 1) {
      userMessage += `\n\n作为参考，上一个分块的摘要是：\n${previousChunkSummary}\n`;
    }
    
    userMessage += `\n\n请在“analysis”字段中，详细描述此分块的主要内容，侧重以下方面，并提供具体文本细节支持：
1.  **关键情节进展**：本分块发生了哪些重要事件？剧情是如何推进的？这些事件的直接后果是什么？与主线故事的关联是什么？
2.  **角色动态与发展**：
    *   主要角色在本分块中有哪些重要行动、关键对话、显著的心理变化或重要的成长/转变？
    *   是否有新登场的重要角色？他们的初步形象、作用和潜力如何？
    *   角色之间的关系（联盟、冲突、情感等）有无新的发展或变化？
3.  **设定与世界观深化**：
    *   是否有新的世界观设定、能力体系、重要物品、关键地点或历史背景被揭示或进一步阐释？
    *   这些新设定如何丰富故事的深度和广度，或为未来情节埋下伏笔？
4.  **伏笔、线索与悬念**：
    *   本分块中是否埋下了新的伏笔，或回收/发展了旧的线索？
    *   是否有新的悬念产生，或者旧的悬念得到解答或进一步发展？这些对整体故事有何潜在影响？
5.  **情绪与氛围营造**：本分块营造的主要情绪基调或氛围是什么（例如：紧张、悬疑、轻松、悲伤、激昂等）？作者是如何通过描写、对话、情节节奏等手段来营造和强化这种氛围的？

请提取此分块中出现的“关键实体”。重点关注那些新引入的、或在本分块中有显著发展/变化的实体，以及代表主要情节转折点、重要设定或核心矛盾的元素。例如：重要人名（包括其身份/称号）、地名、组织机构名、特殊物品名、独特功法/技能名称、核心概念/理论、重大事件/冲突的概括性名称。

请以指定的、严格符合规范的 JSON 格式回应。在 JSON 的字符串值中，确保正确转义特殊字符（例如换行符为 \\n，双引号为 \\"，反斜杠为 \\\\）。JSON 结构：{"summary": "...", "analysis": "...", "extractedEntities": ["实体A", "事件B"]}\n\n--- 分块内容开始 ---\n${chunkContent}\n--- 分块内容结束 ---`;
    
    const contents: Content[] = [{ role: "user", parts: [{ text: userMessage }] }];

    const response = await callGeminiWithRetry(
        () => ai.models.generateContent({ 
            model: APP_GEMINI_MODEL,
            contents: contents,
            config: {
                systemInstruction: systemInstructionForFullChunk,
                responseMimeType: "application/json",
            }
        })
    );
    
    if (!response.candidates || response.candidates.length === 0 || !response.text) {
        const finishReason = response.candidates?.[0]?.finishReason;
        const safetyRatings = response.candidates?.[0]?.safetyRatings;
        let detail = `The AI model returned no content.`;
        if (finishReason) {
            detail += ` Finish reason: ${finishReason}.`;
        }
        if (safetyRatings) {
            detail += ` Safety ratings: ${JSON.stringify(safetyRatings, null, 2)}.`;
        }
        const error = new Error(`AI 对分块 ${chunkNumber} 的回应为空。${detail}`);
        (error as any).isRateLimitError = false;
        throw error;
    }

    const parsedResult = parseJsonResponse<ChunkAnalysisResponse>(response.text);
    
    if (parsedResult.success === false) {
      const error = new Error(`无法解析AI对全本分块 ${chunkNumber} 的回应: ${parsedResult.error} 原始回应: "${parsedResult.rawText}"`);
      (error as any).isRateLimitError = false;
      throw error;
    }

    const data = parsedResult.data;
    if (typeof data.summary !== 'string' || typeof data.analysis !== 'string') {
      const error = new Error(`AI对全本分块 ${chunkNumber} 的回应缺少必需的 'summary' 或 'analysis' 字段. 原始回应: ${response.text}`);
      (error as any).isRateLimitError = false; 
      throw error;
    }
      
    if (!data.extractedEntities || !Array.isArray(data.extractedEntities)) {
      data.extractedEntities = [];
    }
    return data;

  } catch (error: any) {
    console.error(`分析全本分块 ${chunkNumber} 时出错:`, error.message);
     if (error.isRateLimitError === undefined) {
        const newError = new Error(`分析全本分块 ${chunkNumber} 时发生内部错误：${error?.message}`);
        (newError as any).isRateLimitError = false;
        throw newError;
    }
    throw error;
  }
};

export const concludeFullNovelReportInChat = async ( 
  ai: GoogleGenAI,
  novelTitle: string,
  totalAnalyzedChunks: number, 
  allChunkSummaries: string 
): Promise<string> => {
  const reportChat = ai.chats.create({ 
    model: APP_GEMINI_MODEL,
    config: {
         systemInstruction: `你是一位资深文学评论家和小说分析专家，拥有对长篇叙事作品的深刻洞察力与广博的文学知识。你的任务是基于提供的小说各分块摘要及你对这些摘要的综合理解，对整部小说【全书】撰写一份全面、深入、结构清晰、论证严谨的【小说全本综合报告】。
此报告应达到专业评论水平，能够为读者提供关于作品艺术价值、思想内涵及阅读体验的权威参考。请专注于从宏观角度评价作品的整体表现，并结合微观细节进行论证。`,
    }
  });
  
  try {
    const prompt = `对小说《${novelTitle}》（共 ${totalAnalyzedChunks} 个内容分块）的逐块分析素材（摘要）已准备完毕。
以下是所有 ${totalAnalyzedChunks} 个分块的摘要集合。请基于这些摘要以及你在逐块分析过程中形成的理解，对这部小说【全书】进行一次全面、深入、结构化的综合评估报告。
--- 所有分块摘要开始 ---
${allChunkSummaries}
--- 所有分块摘要结束 ---

这份最终报告不应是 JSON 格式，而应是一份结构清晰、分析透彻的【小说全本综合报告】。请务必详细探讨以下方面，提供具体的例子和深入的分析，展现你作为评论家的专业素养：

1.  **整体剧情结构与布局**：
    *   主要故事线有哪些？它们是如何引入、发展、交织、高潮并最终汇合或解决的？
    *   小说的整体结构（如开端、发展、多重高潮、结局；或特定的叙事模型如英雄之旅、三幕式结构等）分析，评价其完整性、平衡性和巧妙性。
    *   分析关键的重大转折点（Plot Twists/Turning Points），阐述它们对剧情走向、角色命运和主题表达的关键影响。

2.  **角色塑造与成长弧光**：
    *   **主角**：深入分析其核心驱动力、性格特质、价值观、以及在整个故事中的成长轨迹（包括关键的成长节点、内心挣扎与转变）。主角形象是否丰满、复杂且令人信服？
    *   **重要配角**：评估重要配角的塑造是否成功？他们各自的功能性（如推动情节、反衬主角、代表特定观点、提供情感支持等）以及他们是否有令人服信的角色弧光或发展？
    *   **反派角色**：反派的动机是什么？其塑造是否扁平化，还是具有多面性和复杂性？反派与主角的对抗关系如何推动剧情并深化主题？

3.  **主题思想与内涵深度**：
    *   小说探讨了哪些核心主题？（例如：正义与邪恶、爱情与牺牲、成长与迷失、权力与责任、人性探索、社会批判、命运与自由意志等）。
    *   这些主题是如何通过情节发展、角色行为与选择、象征意象、对话等具体元素来展现和深化的？
    *   小说最终传达了怎样的价值观或引发了读者怎样的思考？其主题表达是否深刻、一致且具有普遍意义或时代价值？

4.  **世界观构建与设定运用**：
    *   世界观的独特性、内部逻辑的完整性与一致性如何？设定是否仅仅是背景板，还是深度融入并驱动着故事情节和角色行为？
    *   核心设定（如力量体系、社会结构、历史文化背景、科技水平、魔法系统等）对故事的支撑作用、创新程度和吸引力如何？有无冗余或未充分利用的设定？

5.  **文笔风格与叙事技巧**：
    *   作者的文笔特点（例如：细腻、幽默、华丽、平实、凝练、富有张力等）及其与题材、主题的契合度。语言是否精炼，有无阅读障碍？
    *   叙事节奏的掌控：评估小说整体的叙事节奏，高潮与平缓部分的分布与过渡是否得当？有无冗长拖沓或仓促跳跃之感？
    *   叙事视角（第一/第三人称，单/多视角，全知/限知）的选择与运用效果。伏笔的设置与回收水平如何？悬念制造与解答的技巧评价。

6.  **创新性与类型贡献**：
    *   与同类型（如玄幻、科幻、都市、历史、言情等）作品相比，这部小说在题材选择、情节构思、角色设定、主题表达、叙事手法等方面有哪些显著的创新之处或独特亮点？
    *   它在多大程度上遵循或突破了其所属类型的常规模式和读者预期？对该类型文学有何潜在贡献或启发？

7.  **整体优缺点综合评价**：
    *   综合来看，这部小说最显著的2-3个优点是什么？请详细阐述并结合实例。
    *   最主要的2-3个缺点或令人遗憾之处在哪里？请具体分析原因和影响。

8.  **总评、推荐指数及目标读者**：
    *   对这部小说给出一个整体的质量评价等级（例如：史诗级巨著、经典必读、佳作推荐、值得一阅、中规中矩、略有不足、不推荐）。
    *   详细阐述分级理由，并说明其最适合哪些类型的读者群体（可考虑年龄、阅读偏好、对特定元素敏感度等）。
    *   评估其在文学性、娱乐性和思想性上的综合表现。这部作品给读者留下的最深刻的印象或启示是什么？

请确保报告逻辑清晰、论证充分、语言流畅且富有洞察力，充分展现对长篇叙事作品的深刻理解和批判性思维。`;
    
    const response = await callGeminiWithRetry(
        () => reportChat.sendMessage({ message: prompt })
    );
    return response.text;

  } catch (error: any) {
    console.error("总结小说全本报告时出错:", error.message);
    if (error.isRateLimitError === undefined) {
        const newError = new Error(`生成小说全本报告时发生内部错误：${error?.message}`);
        (newError as any).isRateLimitError = false;
        throw newError;
    }
    throw error;
  }
};


export const analyzeCreativeViability = async (
  ai: GoogleGenAI,
  brief: string,
): Promise<ViabilityReport> => {
  const systemInstruction = `你是一位顶尖的网络小说市场分析师和资深编辑，拥有敏锐的市场洞察力和丰富的爆款作品孵化经验。你的任务是基于用户提供的核心创意简介或大纲，生成一份专业、客观、数据驱动的【创意可行性分析报告】。你的分析必须严格、精准，并为创作者提供有价值的决策参考。

你的回应必须是一个有效的、可以直接解析的 JSON 对象。在 JSON 的字符串值中，请确保所有特殊字符都已正确转义。JSON 结构必须严格遵循预设的 schema。`;

  const userMessage = `请根据以下小说创意简介/大纲，生成一份详细的【创意可行性分析报告】。

--- 创意简介开始 ---
${brief}
--- 创意简介结束 ---

请在报告中全面评估以下几个方面：

1.  **新颖度评估 (noveltyScore, noveltyAnalysis)**：
    *   给出一个 1-10 分的【新颖度评分】，1分表示极其陈旧套路，10分表示极具开创性。
    *   在【新颖度分析】中，详细阐述评分理由。明确指出创意中的“亮点”（创新、独特的元素）和“陈旧元素”（常见、俗套的设定）。

2.  **市场匹配度分析 (marketFitAnalysis)**：
    *   【推荐题材分类】：根据创意内容，推荐 1-3 个最匹配的网文题材分类（如：都市、玄幻、科幻、历史、言情等）。
    *   【目标读者画像】：详细描绘这篇小说最可能吸引的核心读者群体特征（如年龄、性别、阅读偏好、爽点需求等）。
    *   【市场潜力预测】：基于当前网文市场趋势，对该创意的潜在市场体量和竞争力进行预测（如：蓝海赛道、红海市场但有差异化优势、小众精品、大众爆款潜力等）。

3.  **潜在毒点预警 (poisonPillWarning)**：
    *   【预警列表】：以列表形式，精准识别并指出设定中可能存在的、容易引起主流读者反感的“毒点”或“雷点”。常见的毒点类型包括但不限于：“主角圣母”、“情节憋屈”、“送女/绿帽”、“文青病”、“强行降智”等。
    *   对于每个预警，提供【类型】、【描述】和【严重性】（高、中、低）。
    *   在【总结】中，对整体的毒点风险进行概括。

4.  **综合评估 (overallAssessment)**：
    *   最后，提供一段【综合评估】。总结该创意的核心优势和主要风险，并给出关于后续创作方向、市场定位或设定调整的建设性意见。

请严格按照指定的 JSON 格式和 schema 输出你的分析报告。`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      noveltyScore: { type: Type.INTEGER, description: "新颖度评分 (1-10)" },
      noveltyAnalysis: { type: Type.STRING, description: "对新颖度的详细分析，指出亮点与陈旧元素。" },
      marketFitAnalysis: {
        type: Type.OBJECT,
        properties: {
          recommendedGenres: { type: Type.ARRAY, items: { type: Type.STRING } },
          targetAudience: { type: Type.STRING, description: "目标读者画像描述。" },
          marketPotential: { type: Type.STRING, description: "市场潜力预测。" },
        },
        required: ["recommendedGenres", "targetAudience", "marketPotential"],
      },
      poisonPillWarning: {
        type: Type.OBJECT,
        properties: {
          warnings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: "毒点类型，例如：'主角圣母'。" },
                description: { type: Type.STRING, description: "对该毒点的具体描述。" },
                severity: { type: Type.STRING, description: "严重性，可选值为 'High', 'Medium', 'Low'。" },
              },
              required: ["type", "description", "severity"],
            },
          },
          summary: { type: Type.STRING, description: "对整体毒点风险的总结。" },
        },
        required: ["warnings", "summary"],
      },
      overallAssessment: { type: Type.STRING, description: "最终的综合评估和建议。" },
    },
    required: ["noveltyScore", "noveltyAnalysis", "marketFitAnalysis", "poisonPillWarning", "overallAssessment"],
  };

  try {
    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: APP_GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: responseSchema as any,
        },
      })
    );

    if (!response.text) {
        const finishReason = response.candidates?.[0]?.finishReason;
        const safetyRatings = response.candidates?.[0]?.safetyRatings;
        let detail = `The AI model returned no content.`;
        if (finishReason) {
            detail += ` Finish reason: ${finishReason}.`;
        }
        if (safetyRatings) {
            detail += ` Safety ratings: ${JSON.stringify(safetyRatings, null, 2)}.`;
        }
      throw new Error(`AI 回应为空。${detail}`);
    }

    const parsedResult = parseJsonResponse<ViabilityReport>(response.text);

    if (parsedResult.success === false) {
      throw new Error(`无法解析AI的回应: ${parsedResult.error} 原始回应: "${parsedResult.rawText}"`);
    }

    return parsedResult.data;

  } catch (error: any) {
    console.error("分析创意可行性时出错:", error.message);
    if (error.isRateLimitError === undefined) {
      const newError = new Error(`分析创意可行性时发生内部错误：${error?.message}`);
      (newError as any).isRateLimitError = false;
      throw newError;
    }
    throw error;
  }
};

export const analyzeChapterQuality = async (
  ai: GoogleGenAI,
  chapterText: string,
): Promise<ChapterReport> => {
    const systemInstruction = `你是一位资深的网文编辑和数据分析师，擅长对单章节进行精准、量化的质量评估。你的任务是客观地分析用户提供的章节文本，并根据预设的指标给出一份结构化的评估报告。你的分析必须严格、客观，并为作者提供可操作的反馈。

你的回应必须是一个有效的、可以直接解析的 JSON 对象。在 JSON 的字符串值中，请确保所有特殊字符都已正确转义。JSON 结构必须严格遵循预设的 schema。`;

    const userMessage = `请对以下网络小说章节进行量化评估，并生成一份详细的分析报告。

--- 章节内容开始 ---
${chapterText}
--- 章节内容结束 ---

请严格按照以下指标进行评估和分析：

1.  **有效剧情推进率 (effectivePlotProgressionRate, progressionAnalysis)**:
    *   评估本章内容中，有多少【百分比】的文本是直接或间接推动主线/重要支线剧情发展的。这包括：解决旧问题、产生新冲突、角色做出关键决策、获得重要信息或能力、关键人物关系发生变化等。
    *   排除对话铺垫、景物描写、内心独白、非必要的设定解释等“水分”内容。给出一个 0-100 的整数百分比。
    *   在【分析】中，简要说明你给出该百分比的理由，指出哪些是有效剧情，哪些可能被视为“灌水”。

2.  **信息密度指数 (informationDensityIndex, densityAnalysis)**:
    *   评估本章抛出的新信息（如背景设定、人物历史、世界观知识等）的数量和呈现方式。
    *   给出一个 1-10 分的【评分】。1-3分表示信息过少、节奏拖沓；4-7分表示信息量适中；8-10分表示信息量过大，可能让读者难以消化。
    *   在【分析】中，说明评分原因，并评价信息呈现的方式是否自然、是否服务于剧情。

3.  **冲突/爽点密度 (conflictClimaxDensity, conflictAnalysis)**:
    *   【计数】本章内发生的明确的冲突、打脸、升级、解谜、获得宝物等能激发读者情绪的关键情节（即“爽点”）的数量。
    *   在【分析】中，列出你识别出的关键情节，并简要评价其强度和效果。

4.  **“钩子”强度评级 (hookStrengthRating, hookAnalysis)**:
    *   评估章节结尾的悬念或“钩子”对读者继续阅读的吸引力。
    *   给出一个【评级】: "High" (高), "Medium" (中), 或 "Low" (低)。
    *   在【分析】中，描述结尾的钩子是什么，并解释你给出该评级的理由。如果缺少钩子，也请明确指出。

5.  **综合评估 (overallAssessment)**:
    *   最后，提供一段【综合评估】。总结本章的整体表现，点出其最大的优点和最需要改进的地方。

请严格按照指定的 JSON 格式和 schema 输出你的分析报告。`;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            effectivePlotProgressionRate: { type: Type.INTEGER, description: "有效剧情推进率 (0-100)" },
            progressionAnalysis: { type: Type.STRING, description: "对剧情推进率的分析和解释。" },
            informationDensityIndex: { type: Type.INTEGER, description: "信息密度指数 (1-10)" },
            densityAnalysis: { type: Type.STRING, description: "对信息密度的分析和解释。" },
            conflictClimaxDensity: { type: Type.INTEGER, description: "冲突/爽点事件的数量" },
            conflictAnalysis: { type: Type.STRING, description: "对冲突/爽点事件的分析和列举。" },
            hookStrengthRating: { type: Type.STRING, description: "钩子强度评级: 'High', 'Medium', 'Low'" },
            hookAnalysis: { type: Type.STRING, description: "对结尾钩子的分析和解释。" },
            overallAssessment: { type: Type.STRING, description: "对本章的最终综合评估和建议。" },
        },
        required: [
            "effectivePlotProgressionRate", "progressionAnalysis",
            "informationDensityIndex", "densityAnalysis",
            "conflictClimaxDensity", "conflictAnalysis",
            "hookStrengthRating", "hookAnalysis",
            "overallAssessment"
        ],
    };

    try {
        const response = await callGeminiWithRetry(() =>
          ai.models.generateContent({
            model: APP_GEMINI_MODEL,
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: responseSchema as any,
            },
          })
        );

        if (!response.text) {
            const finishReason = response.candidates?.[0]?.finishReason;
            const safetyRatings = response.candidates?.[0]?.safetyRatings;
            let detail = `The AI model returned no content.`;
            if (finishReason) {
                detail += ` Finish reason: ${finishReason}.`;
            }
            if (safetyRatings) {
                detail += ` Safety ratings: ${JSON.stringify(safetyRatings, null, 2)}.`;
            }
            throw new Error(`AI 回应为空。${detail}`);
        }

        const parsedResult = parseJsonResponse<ChapterReport>(response.text);

        if (parsedResult.success === false) {
            throw new Error(`无法解析AI的回应: ${parsedResult.error} 原始回应: "${parsedResult.rawText}"`);
        }

        return parsedResult.data;

    } catch (error: any) {
        console.error("分析章节质量时出错:", error.message);
        if (error.isRateLimitError === undefined) {
            const newError = new Error(`分析章节质量时发生内部错误：${error?.message}`);
            (newError as any).isRateLimitError = false;
            throw newError;
        }
        throw error;
    }
};