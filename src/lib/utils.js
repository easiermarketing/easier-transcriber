/**
 * Utility functions for file validation, time formatting, and helpers
 */

export const SUPPORTED_FORMATS = {
  video: ['mkv', 'mp4', 'mov', 'webm'],
  audio: ['mp3', 'wav', 'm4a', 'ogg', 'flac'],
};

export const ALL_SUPPORTED = [...SUPPORTED_FORMATS.video, ...SUPPORTED_FORMATS.audio];

export function getFileExtension(filename) {
  return filename.split('.').pop().toLowerCase();
}

export function isValidFile(file) {
  const ext = getFileExtension(file.name);
  return ALL_SUPPORTED.includes(ext);
}

export function isVideoFile(file) {
  const ext = getFileExtension(file.name);
  return SUPPORTED_FORMATS.video.includes(ext);
}

export function isAudioFile(file) {
  const ext = getFileExtension(file.name);
  return SUPPORTED_FORMATS.audio.includes(ext);
}

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return [hours, minutes, secs].map(x => x.toString().padStart(2, '0')).join(':');
}

export function formatTimeShort(seconds) {
  if (!seconds || isNaN(seconds)) return '0s';
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}m ${secs}s`;
}

export function estimateChunkCount(audioDuration) {
  // 30-second chunks
  return Math.ceil(audioDuration / 30);
}

export function hasWebGPU() {
  return typeof navigator !== 'undefined' && navigator.gpu !== undefined;
}

export function supportsWebWorker() {
  return typeof Worker !== 'undefined';
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return Promise.resolve();
  }
}

export function generateId() {
  return Math.random().toString(36).substring(2, 11);
}
