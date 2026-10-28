import React from 'react';
import { formatTimeShort } from '../lib/utils';

export default function ProgressBar({ progress, statusMessage, estimatedTime, onCancel, isVisible }) {
  if (!isVisible) return null;

  const percentage = Math.round((progress || 0) * 100);

  return (
    <div className="space-y-4 bg-[var(--bg-soft)] p-6 rounded-[var(--r-m)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold mb-1">{statusMessage}</p>
          <p className="text-xs text-[var(--fg-muted)]">
            {percentage}% done
            {estimatedTime > 0 && <span className="ml-2 text-[var(--brand)]">· about {formatTimeShort(estimatedTime)} left</span>}
            {percentage === 0 && estimatedTime === 0 && /^Transcribing/.test(statusMessage || '') && <span className="ml-2">· working on the first part, the time left shows once it finishes</span>}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="px-6 py-2 rounded-full text-sm font-semibold bg-[var(--bg)] hover:bg-[var(--bg-softest)] text-[var(--fg)]"
        >
          Cancel
        </button>
      </div>

      <div className="w-full bg-[var(--bg)] rounded-full h-3 overflow-hidden" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`h-full bg-[var(--brand-fill)] transition-all duration-300 ${percentage === 0 ? 'animate-pulse' : ''}`}
          style={{ width: percentage === 0 ? '12%' : `${percentage}%` }}
        />
      </div>
    </div>
  );
}
