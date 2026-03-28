import React, { useEffect, useState } from 'react';
import { hasWebGPU } from '../lib/utils';

export default function BrowserWarning() {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (!hasWebGPU()) {
      setShowWarning(true);
    }
  }, []);

  if (!showWarning) return null;

  return (
    <div className="bg-darkGrey border-l-4 border-yellow rounded-md p-4 mb-6">
      <div className="flex gap-3">
        <span className="text-yellow text-xl">\u26A0\uFE0F</span>
        <div>
          <p className="font-semibold text-sm">Browser Optimization Note</p>
          <p className="text-xs text-lightGrey mt-1">
            Your browser doesn't support GPU acceleration (WebGPU). Transcription will work but may be significantly slower.
            Consider using Chrome, Edge, or Safari 18+ for the best performance.
          </p>
        </div>
      </div>
    </div>
  );
}
