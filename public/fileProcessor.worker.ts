/// <reference lib="webworker" />

// FIX: Declare mammoth as a global variable to inform TypeScript that it will be available at runtime after importScripts.
declare var mammoth: any;

// This file now contains pure JavaScript to ensure it can be executed directly by the browser as a Web Worker.
// All TypeScript-specific syntax has been removed to resolve the core initialization error.

self.onmessage = async (event) => {
    const { file, textInput, chunkSize, mode, maxChunksForOpening, mammothUrl } = event.data;

    try {
      // mammoth will be available on the global scope ('self') after importScripts runs.
      if (mammothUrl && typeof mammoth === 'undefined') {
        importScripts(mammothUrl);
      }
    } catch (e) {
      self.postMessage({ type: 'error', error: 'Failed to load external libraries in worker: ' + e.message });
      return;
    }

    let actualTotalChunksInFile = 0;
    let extractedText = '';
    let usedEncoding = 'UTF-8 (default)';

    try {
      if (file) {
        self.postMessage({ type: 'info', message: `Processing file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)` });
        const arrayBuffer = await file.arrayBuffer();
        const lowerCaseFileName = file.name.toLowerCase();

        if (lowerCaseFileName.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          if (typeof mammoth === 'undefined' || typeof mammoth.extractRawText !== 'function') {
            self.postMessage({ type: 'error', error: 'DOCX 解析库 (mammoth.js) 未能成功加载。这可能是由于网络问题或浏览器扩展冲突。请尝试刷新页面或在无痕模式下重试。' });
            return;
          }
          try {
            self.postMessage({ type: 'info', message: '正在从 DOCX 文件提取文本...' });
            const result = await mammoth.extractRawText({ arrayBuffer });
            extractedText = result.value;
            self.postMessage({ type: 'info', message: 'DOCX 文本提取完成。' });
          } catch (docxError) {
            self.postMessage({ 
                type: 'error', 
                error: `解析 .docx 文件时发生错误。\n\n这通常意味着文件可能已损坏，或者其内部结构与解析库不兼容。请尝试在 Word 或 WPS 中打开该文件并重新保存一份，这通常能修复文件结构问题。\n\n技术细节: ${docxError.message || '未知错误'}` 
            });
            return;
          }
        } else if (lowerCaseFileName.endsWith('.doc')) {
          self.postMessage({ 
              type: 'error', 
              error: `不支持旧版 .doc 格式文件。\n\n这是一个常见的兼容性问题。.doc 文件是复杂的二进制格式，浏览器无法直接安全地读取其内容。请您先在 Microsoft Word、WPS Office 或其他文档编辑器中将其打开，然后另存为以下推荐格式再上传：\n\n1.  **.docx 格式 (推荐)**：可以保留大部分格式，是最现代和兼容的格式。\n2.  **.txt 格式 (纯文本)**：会丢失所有格式，但内容最纯粹。` 
          });
          return;
        } else if (lowerCaseFileName.endsWith('.txt') || file.type === 'text/plain') {
          self.postMessage({ type: 'info', message: `Decoding text file (${file.name})...` });
          let decodedSuccessfully = false;
          
          // Try UTF-8 (strict)
          try {
            const decoder = new TextDecoder('utf-8', { fatal: true });
            extractedText = decoder.decode(arrayBuffer);
            if (extractedText.length > 0 && (extractedText.split('\uFFFD').length - 1) / extractedText.length < 0.1) {
                 decodedSuccessfully = true;
                 usedEncoding = 'UTF-8';
                 self.postMessage({ type: 'info', message: 'Decoded as UTF-8.' });
            } else if (extractedText.length > 0) {
                 self.postMessage({ type: 'info', message: 'UTF-8 decoding resulted in many replacement characters or empty output, trying GBK.' });
            }
          } catch (e) {
            self.postMessage({ type: 'info', message: 'UTF-8 decoding failed, trying GBK. Error: ' + e.message });
          }

          // If UTF-8 failed or was suspicious, try GBK/GB18030
          if (!decodedSuccessfully) {
            try {
              const decoder = new TextDecoder('gb18030', { fatal: true });
              extractedText = decoder.decode(arrayBuffer);
              decodedSuccessfully = true;
              usedEncoding = 'GB18030/GBK';
              self.postMessage({ type: 'info', message: 'Decoded as GB18030/GBK.' });
            } catch (e) {
              self.postMessage({ type: 'info', message: 'GBK decoding failed, falling back to non-fatal UTF-8. Error: ' + e.message });
            }
          }
          
          if (!decodedSuccessfully) {
            const decoder = new TextDecoder('utf-8', { fatal: false });
            extractedText = decoder.decode(arrayBuffer);
            usedEncoding = 'UTF-8 (fallback)';
            self.postMessage({ type: 'info', message: 'Used non-fatal UTF-8 as fallback.' });
          }

          if (extractedText.trim().length === 0 && arrayBuffer.byteLength > 0) {
             self.postMessage({ type: 'warning', message: `Warning: File (${file.name}) appears to have content but extracted text is empty after decoding with ${usedEncoding}. Check file encoding.` });
          } else if (extractedText.trim().length > 0) {
             self.postMessage({ type: 'info', message: `Text extracted successfully from ${file.name} using ${usedEncoding}.` });
          }
        } else {
          self.postMessage({ type: 'error', error: `不支持的文件类型: ${file.name} (${file.type || '未知'})。目前仅支持 .txt 和 .docx 文件。` });
          return;
        }
      } else if (textInput) {
        extractedText = textInput;
        usedEncoding = 'Pasted Text (assumed UTF-8)';
        self.postMessage({ type: 'info', message: 'Using pasted text.' });
      } else {
        self.postMessage({ type: 'error', error: 'No file or text input provided to worker.' });
        return;
      }

      if (extractedText.trim().length === 0) {
        self.postMessage({ type: 'error', error: 'Extracted text is empty. Cannot proceed with chunking.' });
        return;
      }
      
      const textEncoder = new TextEncoder(); 
      const utf8Buffer = textEncoder.encode(extractedText).buffer;

      actualTotalChunksInFile = Math.ceil(utf8Buffer.byteLength / chunkSize);
      let totalChunksToProcessForWorker = actualTotalChunksInFile;

      if (mode === 'opening' && actualTotalChunksInFile > maxChunksForOpening) {
        totalChunksToProcessForWorker = maxChunksForOpening;
        self.postMessage({ type: 'info', message: `Opening mode: Processing first ${maxChunksForOpening} of ${actualTotalChunksInFile} total chunks.` });
      } else {
        self.postMessage({ type: 'info', message: `Processing all ${actualTotalChunksInFile} chunks for full analysis.` });
      }
      
      self.postMessage({ type: 'chunking_started', actualTotalChunksInFile, totalChunksToProcess: totalChunksToProcessForWorker });

      if (totalChunksToProcessForWorker > 0) {
        // Send the first chunk immediately to start the main thread processing
        const firstChunkStart = 0;
        const firstChunkEnd = Math.min(chunkSize, utf8Buffer.byteLength);
        const firstChunkSlice = utf8Buffer.slice(firstChunkStart, firstChunkEnd);
        self.postMessage({ type: 'first_chunk', chunkBuffer: firstChunkSlice, order: 0 }, [firstChunkSlice]);

        // Batch all subsequent chunks to send them together for performance
        const subsequentChunksData = [];
        const transferableBuffers = [];
        let lastProgressReport = 0;

        for (let i = 1; i < totalChunksToProcessForWorker; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, utf8Buffer.byteLength);
          const chunkBufferSlice = utf8Buffer.slice(start, end);
          subsequentChunksData.push({ order: i, chunkBuffer: chunkBufferSlice });
          transferableBuffers.push(chunkBufferSlice);

          // Report progress periodically to avoid overwhelming the main thread
          const currentProgress = Math.round(((i + 1) / totalChunksToProcessForWorker) * 100);
          if (currentProgress > lastProgressReport && (currentProgress % 5 === 0 || i === totalChunksToProcessForWorker - 1)) {
              self.postMessage({ type: 'chunking_progress', progress: currentProgress });
              lastProgressReport = currentProgress;
          }
        }
        
        // Post the batch if it's not empty
        if (subsequentChunksData.length > 0) {
          self.postMessage({ 
            type: 'chunk_batch', 
            chunks: subsequentChunksData 
          }, transferableBuffers);
        }
      }

      self.postMessage({ type: 'completed', actualTotalChunksInFile, totalChunksProcessed: totalChunksToProcessForWorker, usedEncoding });

    } catch (e) {
      self.postMessage({ type: 'error', error: 'Error in file processing worker: ' + e.message + (e.stack ? '\nStack: ' + e.stack : '') });
    }
};