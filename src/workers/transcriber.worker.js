/**
 * Web Worker for Whisper transcription
 * Runs model loading and inference off the main thread
 */

import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.allowRemoteModels = true;

let transcriber = null;
let isInitializing = false;

self.onmessage = async (e) => {
  const { type, audio, modelSize = 'small' } = e.data;

  if (type === 'init') {
    try {
      if (!transcriber && !isInitializing) {
        isInitializing = true;
        self.postMessage({ type: 'status', message: 'Initializing Whisper model...' });

        const modelName = modelSize === 'medium'
          ? 'onnx-community/whisper-medium.en'
          : 'onnx-community/whisper-small.en';

        // Try WebGPU first, fall back to WASM
        let device = 'webgpu';
        let dtype = 'q8';

        try {
          transcriber = await pipeline('automatic-speech-recognition', modelName, {
            dtype,
            device,
            progress_callback: (progress) => {
              self.postMessage({ type: 'model-progress', progress });
            },
          });
          self.postMessage({ type: 'model-ready', backend: 'webgpu' });
        } catch (gpuError) {
          console.warn('WebGPU initialization failed, falling back to WASM:', gpuError);
          // Fall back to WASM
          transcriber = await pipeline('automatic-speech-recognition', modelName, {
            dtype: 'q8',
            device: 'wasm',
            progress_callback: (progress) => {
              self.postMessage({ type: 'model-progress', progress });
            },
          });
          self.postMessage({ type: 'model-ready', backend: 'wasm' });
        }

        isInitializing = false;
      }
    } catch (error) {
      isInitializing = false;
      self.postMessage({
        type: 'error',
        error: `Failed to initialize Whisper: ${error.message}`
      });
    }
  } else if (type === 'transcribe') {
    try {
      if (!transcriber) {
        throw new Error('Transcriber not initialized. Call init first.');
      }

      self.postMessage({ type: 'status', message: 'Transcribing audio...' });

      const result = await transcriber(audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
      });

      // Process result to extract chunks with timestamps
      const chunks = [];
      let currentChunk = '';
      let currentStart = 0;
      let chunkIndex = 0;

      // Handle different result formats
      if (result.chunks && Array.isArray(result.chunks)) {
        // Already has chunks with timestamps
        result.chunks.forEach((chunk) => {
          chunks.push({
            text: chunk.text || '',
            timestamp: chunk.timestamp || [0, null],
          });
        });
      } else if (result.text) {
        // Plain text result, create single chunk
        chunks.push({
          text: result.text,
          timestamp: [0, null],
        });
      }

      self.postMessage({
        type: 'complete',
        result: {
          text: result.text || '',
          chunks: chunks,
        }
      });
    } catch (error) {
      self.postMessage({
        type: 'error',
        error: `Transcription failed: ${error.message}`
      });
    }
  }
};
