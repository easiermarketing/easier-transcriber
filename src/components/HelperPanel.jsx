import React, { useState } from 'react';
import { HELPER_COMMAND } from '../lib/helper';
import { copyToClipboard } from '../lib/utils';

/**
 * Shown when a YouTube video has no captions we can read. Offers the free
 * helper, which downloads the audio and runs Whisper on the visitor's computer.
 */
export default function HelperPanel({ reason, title, onRetry, onCancel, checking }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="bg-darkGrey rounded-2xl p-6 space-y-5">
      <div>
        <p className="text-xs text-lightGrey/70">{title || 'YouTube video'}</p>
        <h3 className="text-lg font-semibold">{reason}</h3>
        <p className="text-sm text-lightGrey/80 mt-2">
          Easier Transcribe can still transcribe the audio itself, on your computer, with the free helper. It needs{' '}
          <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">
            Node.js
          </a>{' '}
          and one command. Nothing is uploaded.
        </p>
      </div>

      <ol className="space-y-4 text-sm">
        <li className="flex gap-3">
          <span className="flex-none w-6 h-6 rounded-full bg-purple text-white text-xs font-bold flex items-center justify-center">1</span>
          <div className="flex-1 min-w-0">
            <p className="mb-2">Open a terminal and run:</p>
            <div className="flex items-center gap-2 bg-darkBg rounded-lg pl-4 pr-2 py-2">
              <code className="flex-1 font-mono text-cyan overflow-x-auto whitespace-nowrap">{HELPER_COMMAND}</code>
              <button
                onClick={async () => {
                  await copyToClipboard(HELPER_COMMAND);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="px-3 py-1 rounded-full text-xs font-semibold bg-darkGrey hover:bg-black"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex-none w-6 h-6 rounded-full bg-purple text-white text-xs font-bold flex items-center justify-center">2</span>
          <p className="flex-1">
            Come back here and press the button. If your browser asks to let this page reach apps on your device, say yes.
          </p>
        </li>
      </ol>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={onRetry}
          disabled={checking}
          className="px-6 py-3 rounded-full text-sm font-semibold bg-gradient-to-r from-purple to-blue hover:opacity-90 text-white"
        >
          {checking ? 'Looking for the helper…' : 'Transcribe with the helper'}
        </button>
        <button onClick={onCancel} className="px-6 py-3 rounded-full text-sm font-semibold bg-darkBg hover:bg-black text-textLight">
          Start over
        </button>
      </div>

      <p className="text-xs text-lightGrey/60">
        No terminal? Download the video, then drop the file in above and it will be transcribed in your browser.
      </p>
    </div>
  );
}
