import React, { useEffect, useState } from 'react';
import { formatFileSize, formatTimeShort } from '../lib/utils';

const BIG_FILE = 100 * 1024 * 1024;

function onSlowConnection() {
  const c = navigator.connection;
  return Boolean(c && (c.saveData || c.type === 'cellular' || /^(slow-2g|2g|3g)$/.test(c.effectiveType || '')));
}

// Plain words for a long job: what is happening, that nothing is uploaded,
// and what to do to keep it going. Shown for big files and slow connections.
export default function WorkingNotes({ modelMB, fileSize, modelReady }) {
  const [elapsed, setElapsed] = useState(0);
  const [slow] = useState(onSlowConnection);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 1000);
    return () => clearInterval(timer);
  }, []);

  const big = fileSize >= BIG_FILE;
  return (
    <div className="space-y-2 text-sm text-[var(--fg-muted)]" role="status">
      <p>Running for {formatTimeShort(elapsed)}. Keep this screen open until it finishes.</p>
      {big && (
        <p>
          This file is {formatFileSize(fileSize)}, so it can take a while, longer on a phone. It never leaves your device.
        </p>
      )}
      {!modelReady && (big || slow) && (
        <p>
          The first run downloads Whisper{modelMB ? `, about ${modelMB} MB` : ''}.
          {slow ? ' You look to be on a slow or mobile connection, so Wi-Fi is better if you can.' : ''} Next time it
          loads from your browser in seconds.
        </p>
      )}
    </div>
  );
}
