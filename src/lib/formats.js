/**
 * Output format converters for transcript data
 */

export function formatAsPlainText(transcript) {
  if (!transcript) return '';

  if (typeof transcript === 'string') {
    return transcript;
  }

  if (transcript.text) {
    return transcript.text;
  }

  if (Array.isArray(transcript.chunks)) {
    return transcript.chunks.map(chunk => chunk.text || '').join(' ').trim();
  }

  return '';
}

export function formatAsTimestamped(transcript) {
  if (!transcript) return '';

  if (typeof transcript === 'string') {
    return transcript;
  }

  let text = '';

  if (transcript.text && transcript.chunks) {
    // Has both text and chunks with timestamps
    transcript.chunks.forEach((chunk) => {
      if (chunk.timestamp && chunk.timestamp[0] !== null) {
        const startTime = formatSeconds(chunk.timestamp[0]);
        text += `[${startTime}] ${chunk.text}\n`;
      } else {
        text += chunk.text + ' ';
      }
    });
  } else if (transcript.text) {
    // Only plain text available
    text = transcript.text;
  }

  return text.trim();
}

export function formatAsSRT(transcript) {
  if (!transcript) return '';

  if (typeof transcript === 'string') {
    // Can't convert plain text to SRT without timestamps
    return '';
  }

  let srt = '';
  let sequenceNumber = 1;

  if (!transcript.chunks || !Array.isArray(transcript.chunks)) {
    return '';
  }

  let currentStart = 0;
  let currentText = '';

  transcript.chunks.forEach((chunk, index) => {
    if (!chunk.timestamp || chunk.timestamp[0] === null) {
      // No timestamp, accumulate text
      currentText += (currentText ? ' ' : '') + chunk.text;
      return;
    }

    const [start, end] = chunk.timestamp;

    // If there's a gap or it's the last chunk, output the previous section
    if (currentText && (start > currentStart + 5 || index === transcript.chunks.length - 1)) {
      const endTime = end !== null ? end : start + 5;
      srt += formatSRTEntry(
        sequenceNumber++,
        currentStart,
        endTime,
        currentText
      );
      currentText = '';
    }

    // Start new chunk
    if (end !== null) {
      srt += formatSRTEntry(
        sequenceNumber++,
        start,
        end,
        chunk.text
      );
      currentStart = end;
    } else {
      currentStart = start;
      currentText = chunk.text;
    }
  });

  // Output any remaining text
  if (currentText) {
    srt += formatSRTEntry(
      sequenceNumber++,
      currentStart,
      currentStart + 5,
      currentText
    );
  }

  return srt.trim();
}

function formatSRTEntry(number, startSeconds, endSeconds, text) {
  const startTime = formatSRTTime(startSeconds);
  const endTime = formatSRTTime(endSeconds);

  return `${number}\n${startTime} --> ${endTime}\n${text}\n\n`;
}

function formatSeconds(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds)) {
    return '00:00:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return [hours, minutes, secs]
    .map(x => x.toString().padStart(2, '0'))
    .join(':');
}

function formatSRTTime(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds)) {
    return '00:00:00,000';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0'),
    millis.toString().padStart(3, '0'),
  ].join(':').replace(':', ',', 3); // Replace last colon with comma
}

export function getFormatExtension(format) {
  switch (format) {
    case 'srt':
      return '.srt';
    case 'timestamped':
      return '.txt';
    case 'plain':
    default:
      return '.txt';
  }
}

export function prepareForDownload(transcript, format) {
  let content = '';
  let filename = '';

  switch (format) {
    case 'srt':
      content = formatAsSRT(transcript);
      filename = `transcript_${Date.now()}.srt`;
      break;
    case 'timestamped':
      content = formatAsTimestamped(transcript);
      filename = `transcript_${Date.now()}.txt`;
      break;
    case 'plain':
    default:
      content = formatAsPlainText(transcript);
      filename = `transcript_${Date.now()}.txt`;
      break;
  }

  return { content, filename };
}
