
// FIX: Add a triple-slash directive to ensure the TypeScript compiler uses the correct library definitions for a Web Worker environment. This resolves errors with `self.postMessage`.
/// <reference lib="webworker" />

// This file contains the logic for processing the novel file off the main thread.
// It handles text extraction from various file types (.txt, .docx), text decoding,
// and splitting the content into manageable chunks for AI analysis.

// FIX: Declare the mammoth variable to inform TypeScript that it will be available at runtime after being loaded via importScripts.
declare var mammoth: any;

self.onmessage = async (event) => {
    const { file, textInput, chunkSize, mode, maxChunksForOpening, mammothUrl } = event.data;

    try {
      if (mammothUrl && !self.mammoth) {
        importScripts(mammothUrl);
      }
    } catch (e: any) {
      self.postMessage({ type: 'error', error: 'Failed to load external libraries in worker: ' + e.message });
      return;
    }

    const chunkBuffers = [];
    let actualTotalChunksInFile = 0;
    let extractedText = '';
    let usedEncoding = 'UTF-8 (default)';

    try {
      if (file) {
        self.postMessage({ type: 'info', message: `Processing file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)` });
        const arrayBuffer = await file.arrayBuffer();

        if ((file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') && mammoth) {
          self.postMessage({ type: 'info', message: 'Extracting text from DOCX...' });
          const result = await mammoth.extractRawText({ arrayBuffer });
          extractedText = result.value;
          self.postMessage({ type: 'info', message: 'DOCX text extraction complete.' });
        } else if (file.name.endsWith('.txt') || file.type === 'text/plain' || file.name.endsWith('.doc') || file.type === 'application/msword') {
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
          } catch (e: any) {
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
            } catch (e: any) {
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
             self.postMessage({ type: 'warning', message: `Warning: File (${file.name}) appears to have content but extracted text is empty after decoding with ${usedEncoding}. Check file encoding. For .doc files, binary format may not be fully supported.` });
          } else if (extractedText.trim().length > 0) {
             self.postMessage({ type: 'info', message: `Text extracted successfully from ${file.name} using ${usedEncoding}.` });
          }
        } else {
          self.postMessage({ type: 'error', error: `Unsupported file type: ${file.name} (${file.type || 'unknown'}). Only .txt, .doc, and .docx are supported.` });
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
        for (let i = 1; i < totalChunksToProcessForWorker; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, utf8Buffer.byteLength);
          const chunkBufferSlice = utf8Buffer.slice(start, end);
          subsequentChunksData.push({ order: i, chunkBuffer: chunkBufferSlice });
          transferableBuffers.push(chunkBufferSlice);
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

    } catch (e: any) {
      self.postMessage({ type: 'error', error: 'Error in file processing worker: ' + e.message + (e.stack ? '\nStack: ' + e.stack : '') });
    }
  };
