import React, { useState } from 'react';
import { copyToClipboard } from '../lib/utils';

const OPTIONS = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    intro: 'Run this once in a terminal:',
    code: 'claude mcp add easier-transcribe -- npx -y easier-transcribe mcp',
  },
  {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    intro: 'In Claude Desktop, open Settings → Developer → Edit Config, add this, then restart Claude:',
    code: `{
  "mcpServers": {
    "easier-transcribe": {
      "command": "npx",
      "args": ["-y", "easier-transcribe", "mcp"]
    }
  }
}`,
  },
  {
    id: 'terminal',
    label: 'Terminal',
    intro: 'Transcribe a file or link straight from the command line:',
    code: 'npx easier-transcribe meeting.mp4 -f srt -o meeting.srt',
  },
  {
    id: 'api',
    label: 'HTTP API',
    intro: 'Start the helper, then call it from any script or automation on your machine:',
    code: `npx easier-transcribe serve

curl -X POST http://127.0.0.1:17748/transcribe \\
  -H "Content-Type: application/json" \\
  -d '{"source": "https://youtu.be/arj7oStGLkU", "format": "srt"}'`,
  },
];

export default function AIToolsSection() {
  const [active, setActive] = useState(OPTIONS[0].id);
  const [copied, setCopied] = useState(false);
  const option = OPTIONS.find((o) => o.id === active);

  return (
    <section className="mt-20" aria-labelledby="ai-tools-heading">
      <div className="text-center mb-8">
        <h2 id="ai-tools-heading" className="text-2xl md:text-3xl font-bold mb-3">
          Use it from Claude and your other AI tools
        </h2>
        <p className="text-[var(--fg-muted)] max-w-2xl mx-auto">
          Easier Transcribe also comes as a free MCP server and command-line tool. Ask Claude to transcribe a file, a
          link or a YouTube video and it gets the text back, with everything running on your own computer.
        </p>
      </div>

      <div className="bg-[var(--card)] border border-[var(--line-soft)] rounded-[var(--r-l)] p-6">
        <div className="flex flex-wrap gap-2 mb-5" role="tablist" aria-label="Where to use Easier Transcribe">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              role="tab"
              aria-selected={active === o.id}
              onClick={() => {
                setActive(o.id);
                setCopied(false);
              }}
              className={`px-4 py-2 rounded-full text-sm font-semibold ${
                active === o.id ? 'bg-[var(--brand-fill)] text-[var(--on-brand)]' : 'bg-[var(--bg-soft)] text-[var(--fg-muted)] hover:text-[var(--fg)]'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <p className="text-sm mb-3">{option.intro}</p>
        <div className="relative">
          <pre className="bg-[var(--bg-soft)] rounded-[var(--r-m)] p-4 pr-24 text-sm font-mono text-[var(--brand)] overflow-x-auto">{option.code}</pre>
          <button
            onClick={async () => {
              await copyToClipboard(option.code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--card)] border border-[var(--line-soft)] hover:bg-[var(--bg-softest)]"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-[var(--fg-faint)] mt-4">
          Needs Node.js 20 or later. The first Whisper run downloads a 490 MB model once. YouTube videos with captions
          need no model at all.
        </p>
      </div>
    </section>
  );
}
