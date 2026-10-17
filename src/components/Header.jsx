import React from 'react';

export default function Header() {
  return (
    <header className="bg-darkBg border-b border-darkGrey sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img src="/easier-cloud.png" alt="" width="40" height="40" className="w-9 h-9 sm:w-10 sm:h-10 shrink-0" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold whitespace-nowrap">Easier Transcribe</h1>
              <p className="text-xs text-lightGrey">Free, Private, Instant</p>
            </div>
          </div>
          <a
            href="https://easiernow.co"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs sm:text-sm text-lightGrey hover:text-cyan transition-colors"
          >
            By Easier Now
          </a>
        </div>
      </div>
    </header>
  );
}
