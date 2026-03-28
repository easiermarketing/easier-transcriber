import React from 'react';

export default function ModelStatus({ modelProgress, modelReady, backend, error }) {
  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-400 text-sm">
        <p className="font-semibold mb-1">Error</p>
        <p>{error}</p>
      </div>
    );
  }

  if (!modelProgress && modelReady) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">
            {modelReady ? '\u2713 Model Ready' : 'Downloading Whisper Model...'}
          </p>
          <p className="text-xs text-lightGrey">
            {modelReady ? `Running on ${backend || 'WebGPU'}` : 'First-time setup (~460 MB)'}
          </p>
        </div>
        {!modelReady && modelProgress && (
          <span className="text-xs font-bold text-cyan">
            {Math.round(modelProgress * 100)}%
          </span>
        )}
      </div>

      {!modelReady && (
        <div className="w-full bg-darkGrey rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan to-purple transition-all duration-300"
            style={{ width: `${(modelProgress || 0) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
