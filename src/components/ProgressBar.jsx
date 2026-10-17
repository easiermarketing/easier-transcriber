import React from 'react';
import { formatTimeShort } from '../lib/utils';

export default function ProgressBar({ progress, statusMessage, estimatedTime, onCancel, isVisible }) {
  if (!isVisible) return null;

  const percentage = Math.round((progress || 0) * 100);

  return (
    <div className="space-y-4 bg-darkGrey p-6 rounded-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold mb-1">{statusMessage}</p>
          <p className="text-xs text-lightGrey/80">
            {percentage}% done
            {estimatedTime > 0 && <span className="ml-2 text-cyan">· about {formatTimeShort(estimatedTime)} left</span>}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="px-6 py-2 rounded-full text-sm font-semibold bg-darkBg hover:bg-black text-textLight"
        >
          Cancel
        </button>
      </div>

      <div className="w-full bg-darkBg rounded-full h-3 overflow-hidden" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="h-full bg-gradient-to-r from-cyan via-purple to-blue transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
