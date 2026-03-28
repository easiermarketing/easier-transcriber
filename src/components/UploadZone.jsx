import React, { useRef, useState } from 'react';
import { isValidFile, formatFileSize, ALL_SUPPORTED } from '../lib/utils';

export default function UploadZone({ onFileSelect, disabled }) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    setError('');

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) {
      setError('No files selected');
      return;
    }

    const file = files[0];
    validateAndSelect(file);
  };

  const handleFileSelect = (e) => {
    setError('');
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    validateAndSelect(files[0]);
  };

  const validateAndSelect = (file) => {
    // Check file type
    if (!isValidFile(file)) {
      setError(`Unsupported file format. Supported: ${ALL_SUPPORTED.join(', ').toUpperCase()}`);
      return;
    }

    // Check file size (warn if > 2GB)
    if (file.size > 2 * 1024 * 1024 * 1024) {
      const confirmed = window.confirm(
        `This file is ${formatFileSize(file.size)}. Processing very large files may be slow or cause memory issues. Continue?`
      );
      if (!confirmed) return;
    }

    onFileSelect(file);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative border-2 border-dashed rounded-2xl p-12 transition-all
        ${isDragging && !disabled
          ? 'border-cyan bg-darkGrey/50 scale-105'
          : 'border-darkGrey hover:border-purple'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {/* Background glow effect */}
      <div className={`
        absolute inset-0 rounded-2xl opacity-0 transition-opacity
        ${isDragging ? 'opacity-10' : ''}
        bg-gradient-to-br from-cyan via-purple to-blue blur-xl
      `} />

      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        disabled={disabled}
        accept={ALL_SUPPORTED.map(ext => `.${ext}`).join(',')}
      />

      <div className="relative text-center">
        <div className="text-5xl mb-4">
          {isDragging ? 'ð¯' : 'ð'}
        </div>

        <h3 className="text-xl font-bold mb-2">
          {isDragging ? 'Drop your file here' : 'Drop audio or video file'}
        </h3>

        <p className="text-lightGrey text-sm mb-6">
          or{' '}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="text-cyan hover:text-purple font-semibold transition-colors"
          >
            browse from your device
          </button>
        </p>

        <div className="inline-block text-xs text-lightGrey bg-darkGrey px-4 py-2 rounded-full">
          MKV, MP4, MOV, WebM, MP3, WAV, M4A, OGG, FLAC
        </div>
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-400 text-sm">
          â {error}
        </div>
      )}
    </div>
  );
}
