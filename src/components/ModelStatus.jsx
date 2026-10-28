import React, { useEffect, useRef, useState } from 'react';
import { formatTimeShort } from '../lib/utils';

export default function ModelStatus({ modelProgress, modelReady, backend }) {
  const [now, setNow] = useState(Date.now());
  const started = useRef(Date.now());
  const downloadStarted = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (modelReady) {
    return <p className="text-xs text-[var(--fg-faint)]">Whisper is ready, running on {backend}.</p>;
  }

  const percent = Math.round((modelProgress || 0) * 100);
  if (percent > 0 && !downloadStarted.current) downloadStarted.current = now;
  const downloading = percent > 0 && percent < 100;
  const preparing = percent >= 100;
  const waited = (now - started.current) / 1000;
  const downloadElapsed = downloadStarted.current ? (now - downloadStarted.current) / 1000 : 0;
  const left = downloading && percent >= 3 ? (downloadElapsed / percent) * (100 - percent) : 0;

  const title = preparing ? 'Setting Whisper up on your device' : downloading ? 'Downloading the Whisper model' : 'Getting Whisper ready';
  const detail = preparing
    ? 'The download is done. Whisper now sets itself up, which can take a minute or two the first time.'
    : "First time only, about 500 MB. After that it loads from your browser's cache.";

  return (
    <div className="space-y-3 bg-[var(--bg-soft)] p-6 rounded-[var(--r-m)]" role="status">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-[var(--fg-muted)]">{detail}</p>
          <p className="text-xs text-[var(--fg-muted)]">
            {downloading && left > 0 ? `About ${formatTimeShort(left)} left. ` : ''}
            {formatTimeShort(waited)} so far.
          </p>
        </div>
        {downloading && <span className="text-xs font-bold text-[var(--brand)]">{percent}%</span>}
      </div>
      <div className="w-full bg-[var(--bg)] rounded-full h-2 overflow-hidden">
        <div
          className={`h-full bg-[var(--brand-fill)] transition-all duration-300 ${downloading ? '' : 'animate-pulse'}`}
          style={{ width: downloading ? `${percent}%` : preparing ? '100%' : '12%' }}
        />
      </div>
    </div>
  );
}
