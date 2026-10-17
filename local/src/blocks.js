/**
 * Helpers for feeding long recordings to Whisper in blocks. No dependencies,
 * so the website's Web Worker and the local helper share them.
 */

export const SAMPLE_RATE = 16000;

// About two minutes per block, cut at a quiet moment, so progress can be
// reported and memory stays flat on long recordings.
const BLOCK_SECONDS = 120;
const SEARCH_SECONDS = 4;

export function rms(samples, from = 0, to = samples.length) {
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, to - from));
}

/** Whisper invents words ("Thank you.") on silence, so silent blocks are skipped. */
export function isSilent(samples) {
  return rms(samples) < 0.0015;
}

/** Split audio into ~2 minute blocks, each ending at the quietest 50ms near the boundary. */
export function splitAtQuietPoints(samples, blockSeconds = BLOCK_SECONDS) {
  const blocks = [];
  const block = blockSeconds * SAMPLE_RATE;
  const search = SEARCH_SECONDS * SAMPLE_RATE;
  const frame = Math.floor(SAMPLE_RATE / 20);
  let start = 0;

  while (start < samples.length) {
    let end = start + block;
    if (end + search >= samples.length) {
      end = samples.length;
    } else {
      let quietest = end;
      let lowest = Infinity;
      for (let i = end - search; i < end + search; i += frame) {
        const level = rms(samples, i, i + frame);
        if (level < lowest) {
          lowest = level;
          quietest = i + Math.floor(frame / 2);
        }
      }
      end = quietest;
    }
    blocks.push({ start, end });
    start = end;
  }
  return blocks;
}

/** Turn one Whisper result into segments on the recording's own clock. */
export function toSegments(result, offset, blockEnd) {
  const chunks = result.chunks?.length ? result.chunks : [{ text: result.text, timestamp: [0, blockEnd - offset] }];
  const segments = [];
  for (const chunk of chunks) {
    const text = (chunk.text || '').trim();
    if (!text) continue;
    const [from, to] = chunk.timestamp || [];
    const start = offset + (Number.isFinite(from) ? from : 0);
    const end = Math.min(blockEnd, offset + (Number.isFinite(to) ? to : blockEnd - offset));
    segments.push({ start: round(start), end: round(Math.max(end, start)), text });
  }
  return segments;
}

/** Whisper sometimes loops on one line. Keep at most two identical lines in a row. */
export function dropRepeats(segments) {
  return segments.filter((segment, i) => {
    const a = segments[i - 1]?.text;
    const b = segments[i - 2]?.text;
    return !(a === segment.text && b === segment.text);
  });
}

export function round(seconds) {
  return Math.round(seconds * 100) / 100;
}

export function formatMinutes(seconds) {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
