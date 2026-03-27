import React from 'react';

export default function Header() {
  return (
    <header className="bg-darkBg border-b border-darkGrey sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan via-purple to-blue flex items-center justify-center font-bold text-sm">
              ET
            </div>
            <div>
              <h1 className="text-xl font-bold">Easier Transcribe</h1>
              <p className="text-xs text-lightGrey">Free, Private, Instant</p>
            </div>
          </div>
          <a
            href="https://easieragency.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-lightGrey hover:text-cyan transition-colors"
          >
            By Easier Agency
          </a>
        </div>
      </div>
    </header>
  );
}
