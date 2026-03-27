import React from 'react';

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-darkGrey py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Left side: Privacy info */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">ð</span>
              <p className="font-semibold">Your Privacy is Sacred</p>
            </div>
            <p className="text-sm text-lightGrey">
              Easier Transcribe runs entirely in your browser. Your audio and transcripts never
              leave your device. Nothing is uploaded, stored, or analyzed on our servers.
            </p>
          </div>

          {/* Right side: Footer links */}
          <div>
            <p className="text-sm font-semibold mb-4">About</p>
            <div className="flex flex-col gap-2 text-sm">
              <a
                href="https://easieragency.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lightGrey hover:text-cyan transition-colors"
              >
                Easier Agency
              </a>
              <a
                href="https://github.com/easieragency/transcribe"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lightGrey hover:text-cyan transition-colors"
              >
                GitHub
              </a>
              <a
                href="https://easieragency.com/contact"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lightGrey hover:text-cyan transition-colors"
              >
                Contact
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-darkGrey flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-lightGrey">
            Powered by{' '}
            <a
              href="https://huggingface.co"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan ¨over:underline"
            >
              Hugging Face Transformers
            </a>
            {' '}&{' '}
            <a
              href="https://ffmpeg.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan hover:underline"
            >
              FFmpeg
            </a>
          </p>
          <p className="text-xs text-lightGrey">
            Â© 2026 Easier Agency. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
