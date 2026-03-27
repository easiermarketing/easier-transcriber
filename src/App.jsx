import React, { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import BrowserWarning from './components/BrowserWarning';
import UploadZone from './components/UploadZone';
import ModelStatus from './components/ModelStatus';
import ProgressBar from './components/ProgressBar';
import TranscriptOutput from './components/TranscriptOutput';
import { extractAudio, getAudioDuration } from './lib/audio';
import { isVideoFile } from './lib/utils';

export default function App() {
  // State management
  const [selectedFile, setSelectedFile] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelReady, setModelReady] = useState(false);
  const [backend, setBackend] = useState('');
  const [modelError, setModelError] = useState('');
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [fileDuration, setFileDuration] = useState(0);

  const workerRef = useRef(null);
  const transcriptionStartTimeRef = useRef(null);

  // Initialize worker
  useEffect(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('./workers/transcriber.worker.js', import.meta.url),
        { type: 'module' }
      );

      workerRef.current.onmessage = handleWorkerMessage;
      workerRef.current.onerror = handleWorkerError;

      // Initialize transcriber
      workerRef.current.postMessage({ type: 'init', modelSize: 'small' });
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const handleWorkerMessage = (e) => {
    const { type, message, progress, result, backend: workerBackend, error } = e.data;

    switch (type) {
      case 'status':
        setStatusMessage(message);
        break;

      case 'model-progress':
        setModelProgress(progress);
        break;

      case 'model-ready':
        setModelReady(true);
        setBackend(workerBackend);
        setModelProgress(0);
        break;

      case 'complete':
        setTranscript(result);
        setIsTranscribing(false);
        setStatusMessage('');
        setTranscriptionProgress(0);
        break;

      case 'error':
        setModelError(error);
        setIsTranscribing(false);
        break;

      default:
        break;
    }
  };

  const handleWorkerError = (error) => {
    console.error('Worker error:', error);
    setModelError(error.message || 'Worker error occurred');
    setIsTranscribing(false);
  };

  const handleFileSelect = async (file) => {
    setSelectedFile(file);
    setTranscript(null);
    setTranscriptionProgress(0);
    setStatusMessage('');
    setEstimatedTime(0);

    // Start transcription
    await transcribeFile(file);
  };

  const transcribeFile = async (file) => {
    try {
      setIsTranscribing(true);
      setModelError('');
      setStatusMessage('Preparing audio...');

      // Step 1: Extract audio from video or process audio file
      if (isVideoFile(file)) {
        setStatusMessage('Extracting audio from video...');
        try {
          const audioData = await extractAudio(file, (progress) => {
            setTranscriptionProgress(progress * 0.3); // First 30% for extraction
          });

          // Estimate duration from audio data (16kHz = 16000 samples/second)
          const estimatedDuration = audioData.length / 16000;
          setFileDuration(estimatedDuration);

          // Start transcription
          performTranscription(audioData, estimatedDuration);
        } catch (error) {
          setModelError(`Failed to extract audio: ${error.message}`);
          setIsTranscribing(false);
        }
      } else {
        // Audio file - decode directly
        setStatusMessage('Processing audio...');
        try {
          const arrayBuffer = await file.arrayBuffer();
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          // Resample to 16kHz if needed
          const sampleRate = audioBuffer.sampleRate;
          const targetSampleRate = 16000;
          const rawData = audioBuffer.getChannelData(0);

          let audioData = rawData;
          if (sampleRate !== targetSampleRate) {
            audioData = resampleAudio(rawData, sampleRate, targetSampleRate);
          }

          const estimatedDuration = audioBuffer.duration;
          setFileDuration(estimatedDuration);

          // Start transcription
          performTranscription(audioData, estimatedDuration);
        } catch (error) {
          setModelError(`Failed to process audio: ${error.message}`);
          setIsTranscribing(false);
        }
      }
    } catch (error) {
      setModelError(`Transcription failed: ${error.message}`);
      setIsTranscribing(false);
    }
  };

  const performTranscription = (audioData, duration) => {
    transcriptionStartTimeRef.current = Date.now();

    // Estimate chunks and total time
    const chunkCount = Math.ceil(duration / 30);
    const estimatedProcessingTime = chunkCount * 5; // Rough estimate

    setStatusMessage('Transcribing audio...');
    setTranscriptionProgress(0.3); // Already 30% from extraction

    // Send to worker
    workerRef.current.postMessage({
      type: 'transcribe',
      audio: audioData,
      modelSize: 'small',
    });

    // Update progress estimate
    const progressInterval = setInterval(() => {
      if (!isTranscribing) {
        clearInterval(progressInterval);
        return;
      }

      const elapsed = (Date.now() - transcriptionStartTimeRef.current) / 1000;
      const estimated = Math.min(0.95, 0.3 + (elapsed / estimatedProcessingTime) * 0.65);
      setTranscriptionProgress(estimated);

      const remaining = Math.max(0, estimatedProcessingTime - elapsed);
      setEstimatedTime(remaining);
    }, 500);
  };

  const resampleAudio = (audioData, oldSampleRate, newSampleRate) => {
    if (oldSampleRate === newSampleRate) {
      return audioData;
    }

    const ratio = oldSampleRate / newSampleRate;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Float32Array(newLength);

    let offsetResult = 0;
    let offsetAudio = 0;

    while (offsetResult < newLength) {
      const nextOffsetAudio = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;

      for (let i = Math.floor(offsetAudio); i < nextOffsetAudio && i < audioData.length; i++) {
        accum += audioData[i];
        count++;
      }

      result[offsetResult] = accum / count;
      offsetResult++;
      offsetAudio = nextOffsetAudio;
    }

    return result;
  };

  const handleCancel = () => {
    setIsTranscribing(false);
    setTranscriptionProgress(0);
    setStatusMessage('');
    setEstimatedTime(0);
  };

  return (
    <div className="min-h-screen flex flex-col bg-darkBg text-textLight">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12">
        {/* Hero Section */}
        <section className="mb-16 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-cyan via-purple to-blue bg-clip-text text-transparent">
            Transcribe Any Video or Audio
          </h2>
          <p className="text-xl text-lightGrey mb-3">
            Free, Private, Instant
          </p>
          <p className="text-lightGrey max-w-2xl mx-auto mb-4">
            Powered by Whisper AI. Runs entirely in your browser. Nothing is uploaded anywhere.
          </p>
          <div className="inline-flex items-center gap-2 bg-darkGrey px-4 py-2 rounded-full">
            <span className="text-cyan">ð</span>
            <p className="text-sm">Your files never leave your device</p>
          </div>
        </section>

        {/* Browser warning */}
        <BrowserWarning />

        {/* Upload Zone */}
        {!selectedFile && !transcript ? (
          <section className="mb-12">
            <UploadZone onFileSelect={handleFileSelect} disabled={isTranscribing} />
          </section>
        ) : null}

        {/* File info and model status */}
        {selectedFile && (
          <section className="mb-8 space-y-6">
            {/* File info card */}
            <div className="bg-darkGrey p-6 rounded-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-lightGrey">Selected file</p>
                  <p className="font-semibold text-lg">{selectedFile.name}</p>
                </div>
                {!transcript && (
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setTranscript(null);
                    }}
                    className="px-6 py-2 rounded-full text-sm font-semibold bg-darkBg hover:bg-darkGrey text-textLight transition-colors"
                  >
                    Change
                  </button>
                )}
              </div>
            </div>

            {/* Model status */}
            <ModelStatus
              modelProgress={modelProgress}
              modelReady={modelReady}
              backend={backend}
              error={modelError}
            />

            {/* Transcription progress */}
            <ProgressBar
              progress={transcriptionProgress}
              statusMessage={statusMessage}
              estimatedTime={estimatedTime}
              onCancel={handleCancel}
              isVisible={isTranscribing}
            />
          </section>
        )}

        {/* Transcript output */}
        {transcript && (
          <section className="mb-12">
            <TranscriptOutput transcript={transcript} isLoading={isTranscribing} />
          </section>
        )}

        {/* New transcription button */}
        {transcript && !isTranscribing && (
          <section className="text-center mb-12">
            <button
              onClick={() => {
                setSelectedFile(null);
                setTranscript(null);
                setTranscriptionProgress(0);
              }}
              className="px-8 py-4 rounded-full font-bold text-lg bg-gradient-to-r from-purple to-blue hover:opacity-90 text-white transition-opacity"
            >
              Transcribe Another File
            </button>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
