import React, { useEffect, useRef, useState } from 'react';
import { FORMAT_EXTENSIONS, clock, formatTranscript } from '@local/formats.js';
import { copyToClipboard, downloadBlob } from '../lib/utils';

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
  const [maxChars, setMaxChars] = useState(84);
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
    <div className="bg-darkGrey rounded-2xl p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-lightGrey/70">{isLive ? 'Transcribing… text appears as it is ready' : label}</p>
          <h3 className="text-lg font-semibold truncate" title={transcript.title}>
            {transcript.title || 'Transcript'}
          </h3>
          <p className="text-xs text-lightGrey/70">
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
                format === tab.id ? 'bg-purple text-white' : 'bg-darkBg text-lightGrey hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isSubtitles && (
        <div className="flex items-center gap-3">
          <label htmlFor="max-chars" className="text-xs text-lightGrey/80 whitespace-nowrap">
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
            className="flex-1 h-1 accent-cyan cursor-pointer"
          />
          <span className="text-xs text-cyan font-mono w-24 text-right">{maxChars} characters</span>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setEdits((current) => ({ ...current, [format]: e.target.value }))}
        readOnly={isLive}
        spellCheck={format === 'text'}
        aria-label="Transcript"
        className={`w-full h-96 bg-darkBg rounded-xl p-4 text-sm leading-relaxed text-textLight border border-transparent focus:border-purple focus:outline-none ${
          isSubtitles ? '' : 'font-poppins'
        }`}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-lightGrey/70">
          {edits[format] !== undefined ? 'Edited. Copy or download keeps your changes.' : 'You can edit the text before copying it.'}
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            disabled={isLive || !value}
            className="px-6 py-2 rounded-full text-sm font-semibold bg-darkBg hover:bg-black text-textLight"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            disabled={isLive || !value}
            className="px-6 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-purple to-blue hover:opacity-90 text-white"
          >
            Download {FORMAT_EXTENSIONS[format]}
          </button>
        </div>
      </div>
    </div>
  );
}
