# easier-transcribe

Free, private transcription on your own computer. It turns audio files, video files, links and YouTube videos into text, for you, for Claude and for any MCP client or script.

- **Free, with no sign-up.** There are no keys, no accounts and no limits.
- **Private.** Whisper runs on your machine. Files are never uploaded.
- **YouTube is instant.** It reads the video's own captions first. If there are none, it downloads the audio and runs Whisper.
- **Any link.** Direct media links, plus [the sites yt-dlp supports](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md) (Vimeo, Loom, X, TikTok, podcast pages and more).
- **Outputs:** plain text, timestamped text, SRT, VTT and JSON. The JSON includes word timings when YouTube has them.

It needs Node.js 20 or later.

## Use it from Claude

**Claude Code**

```bash
claude mcp add easier-transcribe -- npx -y easier-transcribe mcp
```

**Claude Desktop.** Open Settings → Developer → Edit Config, add this, then restart Claude:

```json
{
  "mcpServers": {
    "easier-transcribe": {
      "command": "npx",
      "args": ["-y", "easier-transcribe", "mcp"]
    }
  }
}
```

**Other MCP clients** (Cursor, Windsurf, VS Code, Cline and so on): add a stdio server that runs `npx -y easier-transcribe mcp`.

Then just ask: *"Transcribe https://youtu.be/arj7oStGLkU"* or *"Make SRT subtitles for ~/Videos/talk.mp4"*.

### Tools

| Tool | What it does |
| --- | --- |
| `transcribe` | `source` (file path, media link, YouTube link or page link), `format` (`text`, `timestamped`, `srt`, `vtt`, `json`), `language`, `captions` (`prefer`, `only`, `skip`), `model`, `save_to`, `wait_seconds`. |
| `check_transcription` | Waits for a long job by `job_id`, or cancels it. |

Whisper takes a while on long recordings. If a job runs longer than `wait_seconds` (50 by default), `transcribe` returns a `job_id` and the client calls `check_transcription` to collect the result. Clients that support MCP progress notifications get live progress. Transcripts over 60,000 characters are saved to a file and the path is returned, so they don't flood the chat.

## Use it from the terminal

```bash
npx easier-transcribe meeting.mp4                    # plain text to the screen
npx easier-transcribe meeting.mp4 -f srt -o meeting.srt
npx easier-transcribe https://youtu.be/arj7oStGLkU -f timestamped
npx easier-transcribe interview.m4a --language es    # any Whisper language
npx easier-transcribe https://youtu.be/... --whisper # ignore captions, use Whisper
npx easier-transcribe setup                          # download the model ahead of time
```

## Use it as a local HTTP API

```bash
npx easier-transcribe serve        # http://127.0.0.1:17748
```

```bash
# A link or a file path
curl -X POST http://127.0.0.1:17748/transcribe \
  -H "Content-Type: application/json" \
  -d '{"source": "https://youtu.be/arj7oStGLkU", "format": "srt"}'

# The bytes of a file
curl -X POST "http://127.0.0.1:17748/transcribe?filename=talk.mp4&format=vtt" \
  -H "Content-Type: video/mp4" --data-binary @talk.mp4
```

A request returns `200` with the transcript when it's done, or `202` with a `job_id` while it is still running. Poll `GET /jobs/<job_id>?wait=30` to get the result, or send `DELETE /jobs/<job_id>` to cancel.

The API only listens on `127.0.0.1`. Web pages can call it only from the Easier Transcribe site, or from origins you add with `--allow-origin`. Pages can send links or file bytes, but never a path on your disk.

## Models and speed

| Model | Download | Notes |
| --- | --- | --- |
| `tiny` | ~150 MB | Fastest, roughest |
| `base` | ~130 MB (English) | |
| `small` (default) | ~490 MB (English) | Best balance |
| `medium` | ~1.5 GB | |
| `turbo` | ~1.6 GB | large-v3-turbo, most accurate, multilingual |

For English (the default) it uses the English-only checkpoints, which are a little more accurate. Set `--language` and it switches to the multilingual model.

On a recent laptop CPU, `small` runs at roughly 1× to 3× real time, so an hour-long recording takes 20 to 60 minutes. YouTube videos with captions take a second or two whatever their length.

## What it downloads, and where

Everything goes into one cache folder: `%LOCALAPPDATA%\easier-transcribe` on Windows, `~/Library/Caches/easier-transcribe` on macOS and `~/.cache/easier-transcribe` on Linux. You can change it with `EASIER_TRANSCRIBE_HOME`.

- **Whisper models** come from Hugging Face on first use.
- **ffmpeg** ships with the package, through `ffmpeg-static`. If that build doesn't work, the ffmpeg on your PATH is used instead.
- **yt-dlp** is only needed for YouTube videos without captions and for other sites. If it isn't on your PATH, the official build is downloaded once from the yt-dlp GitHub releases and checked against its published SHA-256 sums. Set `EASIER_TRANSCRIBE_NO_DOWNLOADS=1` to stop that and use your own.

| Variable | Default | |
| --- | --- | --- |
| `EASIER_TRANSCRIBE_MODEL` | `small` | Default Whisper model |
| `EASIER_TRANSCRIBE_DEVICE` | `cpu` | ONNX Runtime device (`cpu`, `dml`, `cuda`, `coreml`) |
| `EASIER_TRANSCRIBE_PORT` | `17748` | Port for `serve` |
| `EASIER_TRANSCRIBE_ORIGINS` | | Extra comma-separated origins allowed to call `serve` |
| `EASIER_TRANSCRIBE_MAX_INLINE` | `60000` | Longest transcript the MCP server returns inline |
| `EASIER_TRANSCRIBE_FFMPEG` / `EASIER_TRANSCRIBE_YTDLP` | | Use a specific binary |

## How YouTube captions are read

It asks YouTube's player endpoint for the caption tracks, the same way the Android app does, then downloads the chosen track. It needs no key and no sign-in. YouTube can change this at any time. If it does, transcription falls back to Whisper, and a release that fixes it will follow. YouTube sometimes refuses this request from cloud servers, but it works from home and office connections.

Respect the rights of whoever made the video. Transcribing for your own notes, research and accessibility is the intended use.

## Licence

MIT. Whisper is © OpenAI (MIT). FFmpeg is GPL and is downloaded by `ffmpeg-static` at install time. yt-dlp is in the public domain (Unlicense).
