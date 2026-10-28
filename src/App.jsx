import React, { useEffect, useRef, useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import BrowserWarning from './components/BrowserWarning';
import UploadZone from './components/UploadZone';
import EmailSignup from './components/EmailSignup';
import LinkInput from './components/LinkInput';
import ModelStatus from './components/ModelStatus';
import WorkingNotes from './components/WorkingNotes';
import ProgressBar from './components/ProgressBar';
import TranscriptOutput from './components/TranscriptOutput';
import HelperPanel from './components/HelperPanel';
import AIToolsSection from './components/AIToolsSection';
import { extractAudio } from './lib/audio';
import { getYouTubeCaptions } from './lib/youtube';
import { isHelperRunning, transcribeWithHelper } from './lib/helper';
import { HELPER_CAN_HELP, chooseFallback } from './lib/fallback';
import { isValidFile, isVideoFile } from './lib/utils';

// For direct links whose address has no file extension.
const MIME_EXTENSIONS = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/webm': 'webm',
  'video/webm': 'webm',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
};

// On a GPU, one block of audio should never take this long.
const GPU_STALL_MS = 120000;

export default function App() {
  const [phase, setPhase] = useState('idle'); // idle | working | done | helper | error
  const [job, setJob] = useState(null); // { kind: 'file' | 'youtube' | 'helper', label, link }
  const [status, setStatus] = useState({ message: '', progress: 0, eta: 0 });
  const [partial, setPartial] = useState([]);
  const [transcript, setTranscript] = useState(null);
  const [error, setError] = useState('');
  const [helperReason, setHelperReason] = useState('');
  const [helperTitle, setHelperTitle] = useState('');
  const [checkingHelper, setCheckingHelper] = useState(false);
  const [model, setModel] = useState({ ready: false, progress: 0, backend: '', loading: false });

  const workerRef = useRef(null);
  const abortRef = useRef(null);
  const startedRef = useRef(0);
  const fileRef = useRef(null);
  const audioSentRef = useRef(false);
  const audioRef = useRef(null);
  const modelReadyRef = useRef(false);
  const forceWasmRef = useRef(false);
  const onGpuRef = useRef(false);
  const lastProgressRef = useRef(0);
  const runningOnRef = useRef('Transcribing');
  const resultRef = useRef(null);

  useEffect(() => () => workerRef.current?.terminate(), []);
  // Keep a phone screen awake while a long job runs.
  useEffect(() => {
    if (phase !== 'working' || !navigator.wakeLock) return undefined;
    let lock;
    navigator.wakeLock.request('screen').then((l) => { lock = l; }).catch(() => {});
    return () => { lock?.release().catch(() => {}); };
  }, [phase]);
  useEffect(() => {
    if (!resultRef.current || !['done', 'helper', 'error'].includes(phase)) return;
    // Bring the result to just under the sticky header.
    const top = resultRef.current.getBoundingClientRect().top + window.scrollY - 112;
    if (Math.abs(window.scrollY - top) > 40) window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, [phase]);
  useEffect(() => {
    modelReadyRef.current = model.ready;
  }, [model.ready]);

  // If the GPU accepts work but stalls, switch to the processor.
  useEffect(() => {
    if (phase !== 'working' || job?.kind !== 'file') return undefined;
    const timer = setInterval(() => {
      if (onGpuRef.current && audioSentRef.current && Date.now() - lastProgressRef.current > GPU_STALL_MS) switchToCpu();
    }, 5000);
    return () => clearInterval(timer);
  }, [phase, job]);

  const reset = () => {
    abortRef.current?.abort();
    audioSentRef.current = false;
    audioRef.current = null;
    fileRef.current = null;
    setPhase('idle');
    setJob(null);
    setTranscript(null);
    setPartial([]);
    setError('');
    setStatus({ message: '', progress: 0, eta: 0 });
  };

  const fail = (message) => {
    setError(message);
    setPhase('error');
  };

  const handleWorkerMessage = ({ data }) => {
    switch (data.type) {
      case 'model-progress':
        setModel((m) => ({ ...m, progress: data.progress }));
        break;
      case 'model-ready':
        setModel({ ready: true, progress: 1, backend: data.backend, model: data.model, loading: false });
        onGpuRef.current = data.backend.includes('WebGPU');
        runningOnRef.current = `Transcribing on ${data.backend}`;
        lastProgressRef.current = Date.now();
        if (audioSentRef.current) {
          startedRef.current = Date.now();
          setStatus({ message: runningOnRef.current, progress: 0, eta: 0 });
        }
        break;
      case 'gpu-slow':
        switchToCpu();
        break;
      case 'partial':
        lastProgressRef.current = Date.now();
        setPartial((current) => [...current, ...data.segments]);
        break;
      case 'progress': {
        lastProgressRef.current = Date.now();
        const elapsed = (Date.now() - startedRef.current) / 1000;
        const eta = data.progress > 0 ? Math.max(0, elapsed / data.progress - elapsed) : 0;
        setStatus({ message: runningOnRef.current, progress: data.progress, eta });
        break;
      }
      case 'complete':
        setTranscript({ ...data.result, title: fileRef.current?.name, source: fileRef.current?.name });
        setPartial([]);
        audioRef.current = null;
        setPhase('done');
        break;
      case 'error':
        setModel((m) => ({ ...m, loading: false }));
        fail(data.error);
        break;
      default:
        break;
    }
  };

  const getWorker = () => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('./workers/transcriber.worker.js', import.meta.url), { type: 'module' });
      workerRef.current.onmessage = handleWorkerMessage;
      workerRef.current.onerror = (e) => fail(e.message || 'Something went wrong in the transcriber.');
      workerRef.current.postMessage({ type: 'init', forceWasm: forceWasmRef.current });
      setModel((m) => ({ ...m, loading: true }));
    }
    return workerRef.current;
  };

  // A stuck GPU job can't be cancelled, so start a fresh worker on the CPU
  // and give it the audio we already have. This holds for the whole visit.
  function switchToCpu() {
    workerRef.current?.terminate();
    workerRef.current = null;
    forceWasmRef.current = true;
    onGpuRef.current = false;
    setModel({ ready: false, progress: 0, backend: '', loading: false });
    setPartial([]);
    setStatus({ message: 'Your graphics chip is slow in this browser, so switching to your processor', progress: 0, eta: 0 });
    const worker = getWorker();
    if (audioSentRef.current && audioRef.current) {
      startedRef.current = Date.now();
      worker.postMessage({ type: 'transcribe', audio: audioRef.current, forceWasm: true });
    }
  }

  const handleFile = async (file) => {
    reset();
    fileRef.current = file;
    setJob({ kind: 'file', label: file.name });
    setPhase('working');
    // Start loading Whisper while the audio is being prepared.
    getWorker();

    try {
      const isVideo = isVideoFile(file);
      setStatus({ message: isVideo ? 'Pulling the audio out of the video' : 'Reading the audio', progress: 0, eta: 0 });
      const audio = await extractAudio(file, {
        isVideo,
        onProgress: (p) => setStatus({ message: 'Pulling the audio out of the video', progress: p, eta: 0 }),
      });
      if (fileRef.current !== file) return; // cancelled or replaced meanwhile
      // Kept (not transferred) so we can hand it to a CPU worker if the GPU stalls.
      audioRef.current = audio;
      audioSentRef.current = true;
      startedRef.current = Date.now();
      lastProgressRef.current = Date.now();
      setStatus({ message: modelReadyRef.current ? runningOnRef.current : 'Getting Whisper ready', progress: 0, eta: 0 });
      getWorker().postMessage({ type: 'transcribe', audio, forceWasm: forceWasmRef.current });
    } catch (e) {
      fail(e.message);
    }
  };

  const handleLink = async (link) => {
    reset();
    const controller = new AbortController();
    abortRef.current = controller;
    setJob({ kind: 'youtube', label: 'YouTube video', link });
    setPhase('working');
    setStatus({ message: 'Reading the captions', progress: 0, eta: 0 });

    try {
      const result = await getYouTubeCaptions(link);
      if (controller.signal.aborted) return;
      setTranscript(result);
      setPhase('done');
    } catch (e) {
      if (controller.signal.aborted) return;
      const route = await chooseFallback(e.code, isHelperRunning);
      if (controller.signal.aborted) return;
      if (route === 'helper-now') {
        runHelper(link, e.info?.title || '');
      } else if (route === 'helper-panel') {
        setHelperReason(HELPER_CAN_HELP[e.code]);
        setHelperTitle(e.info?.title || '');
        setPhase('helper');
      } else {
        fail(e.message);
      }
    }
  };

  // A direct link to a media file: download it in the browser, then treat it
  // like a dropped file. Only works when the site allows it (CORS).
  const handleMediaLink = async (link) => {
    reset();
    const controller = new AbortController();
    abortRef.current = controller;
    const name = decodeURIComponent(new URL(link).pathname.split('/').pop() || 'download');
    setJob({ kind: 'file', label: name });
    setPhase('working');
    setStatus({ message: 'Downloading the file', progress: 0, eta: 0 });
    let blob;
    try {
      const response = await fetch(link, { signal: controller.signal });
      if (!response.ok) throw new Error(`The site returned ${response.status}.`);
      blob = await response.blob();
    } catch (e) {
      if (controller.signal.aborted) return;
      fail(
        e.message.startsWith('The site')
          ? `Couldn't download that file. ${e.message}`
          : "That site doesn't let browsers fetch its files directly. Download the file and drop it in above instead."
      );
      return;
    }
    const extension = MIME_EXTENSIONS[blob.type.split(';')[0]] || 'mp4';
    const file = new File([blob], /\.[a-z0-9]{2,4}$/i.test(name) ? name : `${name}.${extension}`, { type: blob.type });
    if (!isValidFile(file)) {
      fail("That link isn't an audio or video file we can read. Try a direct link to an MP3, MP4, M4A, WAV or similar.");
      return;
    }
    handleFile(file);
  };

  const handleHelper = async () => {
    setCheckingHelper(true);
    const running = await isHelperRunning();
    setCheckingHelper(false);
    if (!running) {
      setHelperReason("We couldn't find the helper. Is the terminal window with it still open?");
      return;
    }

    runHelper(job.link, helperTitle);
  };

  const runHelper = async (link, title) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setJob({ kind: 'helper', label: title || 'YouTube video', link });
    setPhase('working');
    setStatus({ message: 'Asking the helper to fetch the audio', progress: 0, eta: 0 });
    startedRef.current = Date.now();

    try {
      const result = await transcribeWithHelper(link, {
        signal: controller.signal,
        onProgress: ({ progress, message }) => {
          const elapsed = (Date.now() - startedRef.current) / 1000;
          setStatus({ message: message || 'Transcribing on your computer', progress, eta: progress > 0.02 ? elapsed / progress - elapsed : 0 });
        },
      });
      setTranscript(result);
      setPhase('done');
    } catch (e) {
      if (!controller.signal.aborted) fail(e.message);
    }
  };

  const handleCancel = () => {
    if (job?.kind === 'file' && workerRef.current) {
      // Stopping Whisper mid-run means starting a fresh worker. The model
      // reloads from the browser cache, so the next file starts quickly.
      workerRef.current.terminate();
      workerRef.current = null;
      setModel({ ready: false, progress: 0, backend: '', loading: false });
    }
    reset();
  };

  const working = phase === 'working';
  const liveTranscript = partial.length ? { title: job?.label, segments: partial } : null;

  return (
    <div className="min-h-screen flex flex-col text-[var(--fg)]">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12">
        <section className="mb-12 text-center">
          <p className="inline-flex items-center px-3 py-1 mb-4 rounded-full bg-[var(--brand-soft)] text-[var(--brand)] text-xs font-medium">Free, private, no sign-up</p>
          <h2 className="text-3xl md:text-5xl font-semibold mb-4 text-[var(--fg)] leading-tight">
            Turn any video, audio or YouTube link into text
          </h2>
          <p className="text-xl text-[var(--fg-muted)] mb-3">No limits, no ads.</p>
          <p className="text-[var(--fg-muted)] max-w-2xl mx-auto mb-5">
            Whisper runs right here in your browser, so your files never leave your device.
          </p>
        </section>

        <BrowserWarning />
        <div ref={resultRef} />

        {phase === 'idle' && (
          <section className="space-y-4 mb-12">
            <UploadZone onFileSelect={handleFile} disabled={working} />
            <LinkInput onYouTube={handleLink} onMediaLink={handleMediaLink} disabled={working} />
          </section>
        )}

        {working && (
          <section className="space-y-4 mb-8">
            <div className="bg-[var(--bg-soft)] p-6 rounded-[var(--r-m)]">
              <p className="text-xs text-[var(--fg-faint)]">{job.kind === 'file' ? 'File' : 'Link'}</p>
              <p className="font-semibold text-lg truncate">{job.label}</p>
            </div>
            {job.kind === 'file' && !model.ready && (
              <ModelStatus modelProgress={model.progress} modelReady={model.ready} backend={model.backend} />
            )}
            <WorkingNotes fileSize={fileRef.current?.size || 0} modelReady={model.ready} />
            <ProgressBar
              progress={status.progress}
              statusMessage={status.message}
              estimatedTime={status.eta}
              onCancel={handleCancel}
              isVisible
            />
            {liveTranscript && <TranscriptOutput transcript={liveTranscript} isLive />}
          </section>
        )}

        {phase === 'helper' && (
          <section className="mb-12">
            <HelperPanel reason={helperReason} title={helperTitle} onRetry={handleHelper} onCancel={reset} checking={checkingHelper} />
          </section>
        )}

        {phase === 'error' && (
          <section className="mb-12 space-y-4">
            <div className="p-6 bg-[var(--bad-soft)] border border-[var(--bad)] rounded-[var(--r-l)]">
              <p className="font-semibold text-[var(--bad)] mb-1">That didn't work</p>
              <p className="text-sm text-[var(--fg)]">{error}</p>
            </div>
            <div className="text-center">
              <button onClick={reset} className="px-6 py-3 rounded-full text-sm font-semibold bg-[var(--bg-soft)] hover:bg-[var(--bg-softest)] text-[var(--fg)]">
                Try again
              </button>
            </div>
          </section>
        )}

        {phase === 'done' && transcript && (
          <section className="space-y-8 mb-12">
            <TranscriptOutput transcript={transcript} />
            <EmailSignup />
            <div className="text-center">
              <button
                onClick={reset}
                className="px-8 py-4 rounded-full font-bold text-lg bg-[var(--brand-fill)] hover:bg-[var(--brand-hover)] text-[var(--on-brand)]"
              >
                Transcribe something else
              </button>
            </div>
          </section>
        )}

        <AIToolsSection />
      </main>

      <Footer />
    </div>
  );
}
