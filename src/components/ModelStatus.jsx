import React from 'react';

export default function ModelStatus({ modelProgress, modelReady, backend }) {
  if (modelReady) {
    return <p className="text-xs text-[var(--fg-faint)]">Whisper is ready, running on {backend}.</p>;
  }

  const percent = Math.round((modelProgress || 0) * 100);

  return (
    <div className="space-y-3 bg-[var(--bg-soft)] p-6 rounded-[var(--r-m)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{percent > 0 ? 'Downloading the Whisper model' : 'Getting Whisper ready'}</p>
          <p className="text-xs text-[var(--fg-muted)]">First time only, about 500 MB. After that it loads from your browser's cache.</p>
        </div>
        {percent > 0 && <span className="text-xs font-bold text-[var(--brand)]">{percent}%</span>}
      </div>
      <div className="w-full bg-[var(--bg)] rounded-full h-2 overflow-hidden">
        <div className="h-full bg-[var(--brand-fill)] transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
