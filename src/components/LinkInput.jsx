import React, { useState } from 'react';
import { parseYouTubeId } from '../lib/youtube';

function isWebLink(value) {
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
}

export default function LinkInput({ onYouTube, onMediaLink, disabled }) {
  const [link, setLink] = useState('');
  const [error, setError] = useState('');

  const submit = (value) => {
    const trimmed = value.trim();
    if (parseYouTubeId(trimmed) && /youtu/.test(trimmed)) {
      setError('');
      onYouTube(trimmed);
    } else if (isWebLink(trimmed)) {
      setError('');
      onMediaLink(trimmed);
    } else {
      setError('Paste a YouTube link, or a link to an audio or video file (starting with https://).');
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(link);
      }}
      className="bg-darkGrey rounded-2xl p-6"
    >
      <label htmlFor="youtube-link" className="block text-sm font-semibold mb-3">
        Or paste a YouTube link
      </label>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          id="youtube-link"
          type="url"
          inputMode="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text').trim();
            if (parseYouTubeId(pasted) && /youtu/.test(pasted) && !disabled) {
              e.preventDefault();
              setLink(pasted);
              submit(pasted);
            }
          }}
          placeholder="https://www.youtube.com/watch?v=…"
          disabled={disabled}
          className="flex-1 min-w-0 bg-darkBg rounded-full px-5 py-3 text-sm text-textLight placeholder:text-lightGrey/40 border border-transparent focus:border-purple focus:outline-none"
        />
        <button
          type="submit"
          disabled={disabled || !link.trim()}
          className="px-6 py-3 rounded-full text-sm font-semibold bg-gradient-to-r from-purple to-blue hover:opacity-90 text-white whitespace-nowrap"
        >
          Get transcript
        </button>
      </div>
      <p className="text-xs text-lightGrey/60 mt-3">
        Uses the video's own captions, so most videos take a couple of seconds. A direct link to an MP3 or MP4 works too.
      </p>
      {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
    </form>
  );
}
