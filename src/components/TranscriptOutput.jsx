import React, { useEffect, useRef, useState } from 'react';
import { FORMAT_EXTENSIONS, clock, formatTranscript } from '@local/formats.js';
import { copyToClipboard, downloadBlob } from '../lib/utils';
import { AI_APPS, buildAskPrompt } from '../lib/askAI';

const TABS = [
  { id: 'text', label: 'Text' },
  { id: 'timestamped', label: 'Timestamped' },
  { id: 'srt', label: 'SRT' },
  { id: 'vtt', label: 'VTT' },
];

const SOURCE_LABELS = {
  'youtube-captions': "From the video's own captions",
  'youtube-auto-captions': "From YouTube's automatic captions",
  whisper: 'Transcribed by Whisper in your browser',
  helper: 'Transcribed by Whisper on your computer',
};

function fileName(transcript, format) {
  const base = (transcript.title || 'transcript')
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'transcript';
  return `${base}${FORMAT_EXTENSIONS[format]}`;
}

export default function TranscriptOutput({ transcript, isLive = false }) {
  const [format, setFormat] = useState('text');
  const [edits, setEdits] = useState({});
  const [copied, setCopied] = useState(false);
  const [pasteHint, setPasteHint] = useState('');
  const [maxChars, setMaxChars] = useState(84);
  const longTranscript = buildAskPrompt(edits.text ?? formatTranscript(transcript, 'text', { maxChars }), transcript.title).needsPaste;
  const textareaRef = useRef(null);
  const isSubtitles = format === 'srt' || format === 'vtt';

  // A new transcript throws away edits to the old one.
  useEffect(() => setEdits({}), [transcript.source, transcript.title]);

  const generated = formatTranscript(transcript, format, { maxChars });
  const value = edits[format] ?? generated;

  // Keep the newest words in view while a transcript is still arriving.
  useEffect(() => {
    if (isLive && textareaRef.current) textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
  }, [isLive, generated]);

  const handleAsk = (app) => {
    const text = edits.text ?? formatTranscript(transcript, 'text', { maxChars });
    const { prompt, needsPaste } = buildAskPrompt(text, transcript.title);
    if (needsPaste) {
      copyToClipboard(text);
      setPasteHint(`Your transcript is copied. When ${app.name} opens, press paste (Ctrl+V, or Cmd+V on a Mac) and send.`);
    } else {
      setPasteHint('');
    }
    window.open(app.url(prompt), '_blank', 'noopener');
  };


  const handleCopy = async () => {
    await copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    downloadBlob(new Blob([value], { type: 'text/plain;charset=utf-8' }), fileName(transcript, format));
  };

  const label = transcript.via === 'helper' ? SOURCE_LABELS.helper : SOURCE_LABELS[transcript.method];
  const words = value.split(/\s+/).filter(Boolean).length;

  return (
    <div className="bg-[var(--card)] border border-[var(--line-soft)] rounded-[var(--r-l)] p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-[var(--fg-faint)]">{isLive ? 'Transcribing… text appears as it is ready' : label}</p>
          <h3 className="text-lg font-semibold truncate" title={transcript.title}>
            {transcript.title || 'Transcript'}
          </h3>
          <p className="text-xs text-[var(--fg-faint)]">
            {transcript.duration ? `${clock(transcript.duration)} · ` : ''}
            {words.toLocaleString()} words
          </p>
        </div>

        <div className="flex flex-wrap md:flex-nowrap md:shrink-0 gap-2" role="tablist" aria-label="Transcript format">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={format === tab.id}
              onClick={() => setFormat(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold ${
                format === tab.id ? 'bg-[var(--brand-fill)] text-[var(--on-brand)]' : 'bg-[var(--bg-soft)] text-[var(--fg-muted)] hover:text-[var(--fg)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isSubtitles && (
        <div className="flex items-center gap-3">
          <label htmlFor="max-chars" className="text-xs text-[var(--fg-muted)] whitespace-nowrap">
            Longest subtitle
          </label>
          <input
            id="max-chars"
            type="range"
            min="30"
            max="200"
            step="2"
            value={maxChars}
            onChange={(e) => {
              setMaxChars(Number(e.target.value));
              // Changing the length rebuilds the subtitles.
              setEdits((current) => ({ ...current, srt: undefined, vtt: undefined }));
            }}
            className="flex-1 h-1 accent-[var(--brand-fill)] cursor-pointer"
          />
          <span className="text-xs text-[var(--brand)] font-mono w-24 text-right">{maxChars} characters</span>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setEdits((current) => ({ ...current, [format]: e.target.value }))}
        readOnly={isLive}
        spellCheck={format === 'text'}
        aria-label="Transcript"
        className={`w-full h-96 bg-[var(--bg-soft)] rounded-[var(--r-m)] p-4 text-sm leading-relaxed text-[var(--fg)] border border-transparent focus:border-[var(--brand)] focus:outline-none ${
          isSubtitles ? '' : 'font-poppins'
        }`}
      />

      {!isLive && value && (
        <div className="space-y-3 rounded-[var(--r-l)] bg-[var(--brand-soft)] p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand)]">Ask an AI about this</p>
          <div className="flex flex-col sm:flex-row gap-3">
            {Object.entries(AI_APPS).map(([id, app]) => (
              <button
                key={id}
                onClick={() => handleAsk(app)}
                className="min-h-[52px] flex-1 px-8 rounded-full text-base font-semibold bg-[var(--brand-fill)] hover:bg-[var(--brand-hover)] text-[var(--on-brand)]"
              >
                Start in {app.name}
              </button>
            ))}
          </div>
          <p className="text-sm text-[var(--fg-muted)]">
            {longTranscript
              ? 'This one is long. We copy the transcript, open the app, and you press paste (Ctrl+V, or hold and paste on a phone) and send.'
              : 'Opens the app with your transcript and a summary request ready to go.'}
          </p>
          {pasteHint && <p className="text-sm font-semibold text-[var(--brand)]" role="status">{pasteHint}</p>}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--fg-faint)]">
          {edits[format] !== undefined ? 'Edited. Copy or download keeps your changes.' : 'You can edit the text before copying it.'}
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            disabled={isLive || !value}
            className="px-6 py-2 rounded-full text-sm font-semibold bg-[var(--bg-soft)] hover:bg-[var(--bg-softest)] text-[var(--fg)]"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            disabled={isLive || !value}
            className="px-6 py-2 rounded-full text-sm font-semibold bg-[var(--brand-fill)] hover:bg-[var(--brand-hover)] text-[var(--on-brand)]"
          >
            Download {FORMAT_EXTENSIONS[format]}
          </button>
        </div>
      </div>
    </div>
  );
}
