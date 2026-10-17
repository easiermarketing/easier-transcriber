import React from 'react';

export default function ModelStatus({ modelProgress, modelReady, backend }) {
  if (modelReady) {
    return <p className="text-xs text-lightGrey/60">Whisper is ready, running on {backend}.</p>;
  }

  const percent = Math.round((modelProgress || 0) * 100);

  return (
    <div className="space-y-3 bg-darkGrey p-6 rounded-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{percent > 0 ? 'Downloading the Whisper model' : 'Getting Whisper ready'}</p>
          <p className="text-xs text-lightGrey/80">First time only, about 500 MB. After that it loads from your browser's cache.</p>
        </div>
        {percent > 0 && <span className="text-xs font-bold text-cyan">{percent}%</span>}
      </div>
      <div className="w-full bg-darkBg rounded-full h-2 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-cyan to-purple transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
