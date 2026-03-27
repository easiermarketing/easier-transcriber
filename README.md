# Easier Transcribe

Free, browser-based video/audio transcription powered by OpenAI Whisper. Runs entirely on your device â nothing is uploaded anywhere.

## How it works

1. Drop a video or audio file into the browser
2. Whisper AI transcribes it using your device's GPU (or CPU as fallback)
3. Copy or download the transcript as plain text or SRT subtitles

No accounts. No uploads. No cost. Genuinely private.

## Tech stack

- **Transcription:** OpenAI Whisper (Small model) via `@huggingface/transformers`
- **Audio extraction:** `ffmpeg.wasm` (handles MKV, MP4, MOV, etc.)
- **Frontend:** React + Vite + Tailwind CSS
- **Processing:** WebGPU acceleration with WASM fallback
- **Hosting:** Static files only â no backend required

## Development

```bash
npm install
npm run dev
```

## Build & Deploy

```bash
npm run build
# Deploy the dist/ folder to any static host
```

## Documentation

See [docs/PRD.md](docs/PRD.md) for the full product requirements document.

---

Built by [Easier Agency](https://easieragency.com)
