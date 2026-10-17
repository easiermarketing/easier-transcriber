/**
 * Transcript output formats. Shared by the website and the local helper.
 *
 * A transcript is { segments: [{ start, end, text }], words?, ...details },
 * with times in seconds.
 */

export const FORMATS = ['text', 'timestamped', 'srt', 'vtt', 'json'];

export const FORMAT_EXTENSIONS = {
  text: '.txt',
  timestamped: '.txt',
  srt: '.srt',
  vtt: '.vtt',
  json: '.json',
};

/** Plain text, with a new paragraph wherever the speaker pauses for 3s or more. */
export function toPlainText(segments = []) {
  let output = '';
  segments.forEach((segment, i) => {
    const text = segment.text.trim();
    if (!text) return;
    const previous = segments[i - 1];
    if (!output) output = text;
    else if (previous && segment.start - previous.end >= 3) output += `\n\n${text}`;
    else output += ` ${text}`;
  });
  return output;
}

export function toTimestamped(segments = []) {
  return segments
    .filter((s) => s.text.trim())
    .map((s) => `[${clock(s.start)}] ${s.text.trim()}`)
    .join('\n');
}

/** maxChars (optional) splits long lines into shorter subtitles. */
export function toSRT(segments = [], { maxChars } = {}) {
  return cues(segments, maxChars)
    .map((cue, i) => `${i + 1}\n${cueTime(cue.start, ',')} --> ${cueTime(cue.end, ',')}\n${cue.text}`)
    .join('\n\n');
}

export function toVTT(segments = [], { maxChars } = {}) {
  const body = cues(segments, maxChars)
    .map((cue) => `${cueTime(cue.start, '.')} --> ${cueTime(cue.end, '.')}\n${cue.text}`)
    .join('\n\n');
  return `WEBVTT\n\n${body}`;
}

export function formatTranscript(transcript, format = 'text', options = {}) {
  const segments = transcript?.segments || [];
  switch (format) {
    case 'timestamped':
      return toTimestamped(segments);
    case 'srt':
      return toSRT(segments, options);
    case 'vtt':
      return toVTT(segments, options);
    case 'json':
      return JSON.stringify({ ...transcript, text: toPlainText(segments) }, null, 2);
    case 'text':
    default:
      return toPlainText(segments);
  }
}

/** Subtitle cues need an end after the start and no overlap with the next cue. */
function cues(segments, maxChars) {
  const list = segments.filter((s) => s.text.trim());
  const timed = list.map((segment, i) => {
    const next = list[i + 1];
    let end = Number.isFinite(segment.end) && segment.end > segment.start ? segment.end : segment.start + 3;
    if (next && end > next.start) end = Math.max(segment.start + 0.5, next.start);
    return { start: segment.start, end, text: segment.text.trim() };
  });
  return maxChars > 0 ? timed.flatMap((cue) => splitCue(cue, maxChars)) : timed;
}

/** Break a long cue at word boundaries, sharing its time out by length. */
function splitCue(cue, maxChars) {
  if (cue.text.length <= maxChars) return [cue];
  const lines = [];
  let line = '';
  for (const word of cue.text.split(/\s+/)) {
    if (line && line.length + 1 + word.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);

  const total = lines.reduce((sum, l) => sum + l.length, 0);
  const span = cue.end - cue.start;
  let start = cue.start;
  return lines.map((text, i) => {
    const end = i === lines.length - 1 ? cue.end : Math.round((start + (span * text.length) / total) * 1000) / 1000;
    const piece = { start, end, text };
    start = end;
    return piece;
  });
}

/** 754.2 -> "00:12:34" */
export function clock(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

/** 754.25 -> "00:12:34,250" (SRT) or "00:12:34.250" (VTT) */
function cueTime(seconds, separator) {
  const ms = Math.max(0, Math.round((Number(seconds) || 0) * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const rest = ms % 1000;
  return `${[h, m, s].map((n) => String(n).padStart(2, '0')).join(':')}${separator}${String(rest).padStart(3, '0')}`;
}
