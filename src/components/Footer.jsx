import React from 'react';

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-darkGrey py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="4" y="10" width="16" height="11" rx="2" stroke="#6EF6FF" strokeWidth="2" />
                <path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="#6EF6FF" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p className="font-semibold">Your files stay with you</p>
            </div>
            <p className="text-sm text-lightGrey/80">
              Files are transcribed inside your browser. Your audio and transcripts never leave your device, and we
              don't store or see anything you transcribe. If you give us your email address, that is all we keep. For YouTube links, we ask YouTube for the video's captions and that's all.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold mb-4">About</p>
            <div className="flex flex-col gap-2 text-sm">
              <a href="https://easiernow.co" target="_blank" rel="noopener noreferrer" className="text-lightGrey/80 hover:text-cyan">
                Easier Now
              </a>
              <a href="https://easiernow.co/contact" target="_blank" rel="noopener noreferrer" className="text-lightGrey/80 hover:text-cyan">
                Contact us
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-darkGrey flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-lightGrey/70">
            Powered by{' '}
            <a href="https://github.com/openai/whisper" target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">
              Whisper
            </a>
            ,{' '}
            <a href="https://huggingface.co/docs/transformers.js" target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">
              Transformers.js
            </a>{' '}
            and{' '}
            <a href="https://ffmpeg.org" target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">
              FFmpeg
            </a>
          </p>
          <p className="text-xs text-lightGrey/70">© 2026 Easier Now</p>
        </div>
      </div>
    </footer>
  );
}
