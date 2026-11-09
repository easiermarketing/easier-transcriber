import React from 'react';
import { EXTENSION_URL } from '../config';

// Sits at the top of the page, above the tool. Same job as the tool, but for
// the page you are already on: one click on a video, no file to find.
export default function ExtensionCTA() {
  return (
    <section className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-[var(--card)] border border-[var(--line-soft)] p-5 rounded-[var(--r-m)]">
      <div className="text-center sm:text-left">
        <p className="font-semibold">On a video right now?</p>
        <p className="text-sm text-[var(--fg-muted)]">The free Chrome extension finds the video on the page and turns it into text in one click.</p>
      </div>
      {EXTENSION_URL ? (
        <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" className="shrink-0 px-6 py-3 rounded-full font-bold text-sm bg-[var(--brand-fill)] hover:bg-[var(--brand-hover)] text-[var(--on-brand)]">
          Add to Chrome
        </a>
      ) : (
        <span className="shrink-0 px-6 py-3 rounded-full font-semibold text-sm bg-[var(--bg-soft)] text-[var(--fg-muted)]">Chrome extension coming soon</span>
      )}
    </section>
  );
}
