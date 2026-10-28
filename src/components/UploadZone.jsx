import React, { useRef, useState } from 'react';
import { isValidFile, formatFileSize, ALL_SUPPORTED } from '../lib/utils';

function UploadIcon({ active }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true" className="mx-auto text-[var(--brand)]">
      <rect x="1" y="1" width="46" height="46" rx="23" stroke="currentColor" strokeWidth="2" />
      <path
        d={active ? 'M24 14v18m0 0-7-7m7 7 7-7' : 'M24 32V14m0 0-7 7m7-7 7 7'}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
    </svg>
  );
}

export default function UploadZone({ onFileSelect, disabled }) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    setError('');
    if (disabled) return;
    const [file] = Array.from(e.dataTransfer.files);
    if (!file) {
      setError('No file found in what you dropped.');
      return;
    }
    validateAndSelect(file);
  };

  const handleFileSelect = (e) => {
    setError('');
    const [file] = Array.from(e.target.files);
    e.target.value = '';
    if (file) validateAndSelect(file);
  };

  const validateAndSelect = (file) => {
    if (!isValidFile(file)) {
      setError(`That file type isn't supported. Try one of: ${ALL_SUPPORTED.join(', ').toUpperCase()}.`);
      return;
    }
    if (file.size > 2 * 1024 * 1024 * 1024) {
      const confirmed = window.confirm(
        `This file is ${formatFileSize(file.size)}. Browsers struggle with files over 2 GB, so it may fail. For long recordings the free helper (npx easier-transcribe) is more reliable. Try anyway?`
      );
      if (!confirmed) return;
    }
    onFileSelect(file);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          fileInputRef.current?.click();
        }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Choose an audio or video file to transcribe"
      className={`
        relative border border-[var(--line)] rounded-[var(--r-l)] p-12 transition-all focus:outline-none focus-visible:border-[var(--brand)]
        ${isDragging && !disabled ? 'border-[var(--brand)] bg-[var(--bg-soft)]' : 'border-[var(--line)] hover:border-[var(--brand)]'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        disabled={disabled}
        accept={ALL_SUPPORTED.map((ext) => `.${ext}`).join(',')}
      />

      <div className="relative text-center">
        <div className="mb-4">
          <UploadIcon active={isDragging} />
        </div>
        <h3 className="text-xl font-bold mb-2">{isDragging ? 'Drop it here' : 'Drop an audio or video file'}</h3>
        <p className="text-[var(--fg-muted)] text-sm mb-6">
          or <span className="text-[var(--brand)] font-semibold">choose one from your device</span>
        </p>
        <div className="inline-block text-xs text-[var(--fg-muted)] bg-[var(--bg-soft)] px-4 py-2 rounded-full">
          {ALL_SUPPORTED.map((ext) => ext.toUpperCase()).join(', ')}
        </div>
      </div>

      {error && (
        <div className="relative mt-6 p-4 bg-[var(--bad-soft)] border border-[var(--bad)] rounded-[var(--r-m)] text-[var(--bad)] text-sm">{error}</div>
      )}
    </div>
  );
}
