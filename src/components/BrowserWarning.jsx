import React, { useEffect, useState } from 'react';
import { hasWebGPU } from '../lib/utils';

export default function BrowserWarning() {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (!hasWebGPU()) setShowWarning(true);
  }, []);

  if (!showWarning) return null;

  return (
    <div className="bg-darkGrey border-l-4 border-yellow rounded-md p-4 mb-6">
      <p className="font-semibold text-sm">Your browser will be slower at this</p>
      <p className="text-xs text-lightGrey/80 mt-1">
        It doesn't support GPU acceleration (WebGPU), so file transcription runs on the processor instead. It still
        works, just more slowly. Chrome, Edge or Safari 18+ are much faster. YouTube links are just as quick either way.
      </p>
    </div>
  );
}
