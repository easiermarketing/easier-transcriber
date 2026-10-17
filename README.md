# Easier Transcribe

Free transcription with no sign-up, no limits and no ads. Turn video, audio or a YouTube link into text.

There are two parts:

| | What it is | Where it runs |
| --- | --- | --- |
| **Website** (`/`, `src/`) | Drop a file or paste a YouTube link | Whisper runs in your browser (WebGPU, with a WASM fallback). Files never leave your device. |
| **Helper** (`local/`, published as [`easier-transcribe`](local/README.md)) | MCP server for Claude and other AI tools, CLI and local HTTP API | On your own computer. Files never leave it. |

## How each kind of input is handled

| Input | Website | Helper (MCP, CLI, API) |
| --- | --- | --- |
| Audio or video file | Whisper in the browser. ffmpeg.wasm pulls the audio out of video files. | Whisper with ONNX Runtime. Audio is decoded by ffmpeg. |
| YouTube link with captions | The video's own captions, in about 2 seconds | The same |
| YouTube link without captions | Offers the helper, or asks you to download the video and drop the file in | yt-dlp fetches the audio, then Whisper transcribes it |
| Other links (Vimeo, Loom, podcasts, direct MP3s) | Not on the website | Direct media is read with ffmpeg, pages with yt-dlp, then Whisper transcribes it |

## What it costs to run

- **Website:** a static site plus one small Cloudflare Pages Function (`functions/api/youtube.js`). The function asks YouTube for a video's caption list, because browsers aren't allowed to make that request themselves. The free Cloudflare plan covers it: 100,000 function requests a day and unlimited static requests. Whisper models come from Hugging Face's CDN, and ONNX Runtime and ffmpeg.wasm from jsDelivr and unpkg. All are free.
- **Helper:** nothing. It runs on the user's computer.

## Development

```bash
npm install
npm run dev            # http://localhost:5173, with /api/youtube running in the dev server
npm run build          # static site in dist/, plus functions/ for Cloudflare Pages
```

The helper has its own package:

```bash
cd local
npm install
node src/cli.js https://youtu.be/arj7oStGLkU      # CLI
node src/cli.js mcp                                # MCP server (stdio)
node src/cli.js serve                              # HTTP API on 127.0.0.1:17748
```

The website shares the YouTube, format and audio-block code with the helper through the `@local` alias, which points at `local/src`.

## Deploy (Cloudflare Pages)

- Build command: `npm run build`
- Output directory: `dist`
- `functions/` is picked up automatically for `/api/youtube`
- `public/_headers` sets the cross-origin isolation headers (COOP/COEP) that let WASM use multiple threads

The helper is published to npm from `local/` with `npm publish`.

## Documentation

See [docs/PRD.md](docs/PRD.md) for the original product requirements.

---

Built by [Easier Now](https://easiernow.co)
