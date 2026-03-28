# Product Requirements Document: Easier Transcribe

**Version:** 1.0
**Date:** 2026-03-27
**Author:** Anthony / Easier Agency
**Status:** Draft

---

## 1. Executive Summary

Easier Transcribe is a free, browser-based video/audio transcription tool that runs entirely on the user's device â zero server-side processing, zero cost to operate. It uses OpenAI's Whisper model via WebGPU/WebAssembly to deliver accurate speech-to-text directly in the browser.

The tool serves a dual purpose: a public-facing lead magnet for Easier Agency (driving traffic and demonstrating technical credibility) and an internal utility for transcribing Anthony's raw video recordings.

### Why this exists

Most free transcription tools either: (a) require uploading files to a server (privacy concerns, processing costs), (b) have aggressive paywalls after 1-2 uses, or (c) produce garbage output. Easier Transcribe solves all three â it's accurate (Whisper), private (nothing leaves the browser), and genuinely free (no server costs to subsidise).

---

## 2. Problem Statement

**For prospects/leads:**
- Marketers, content creators, and small business owners regularly need transcriptions of meetings, podcasts, video content, and interviews.
- Existing free tools are either inaccurate, limited, or require uploading sensitive audio to third-party servers.
- Paid tools (Otter.ai, Rev, Descript) cost $15-30/month â overkill for occasional use.

**For Anthony (internal use):**
- Raw video recordings (MKV format, 1-3+ hours, multi-GB) in Google Drive need transcription.
- Transcripts feed the Easier Agency content pipeline (content-engine, write-technical-lesson, etc.).
- Current workflow is manual and slow.

---

## 3. Target Users

### Primary: Lead magnet audience
- Marketing managers, founders, content creators
- Need to transcribe a meeting, podcast episode, or video recording
- Privacy-conscious (don't want to upload audio to unknown servers)
- Not technical enough to install Python/CLI tools
- Willing to use a browser tool that "just works"

### Secondary: Anthony (internal)
- Transcribing raw MKV recordings for the content pipeline
- Longer files (1-3 hours) â may use the web UI for shorter clips, CLI for marathon recordings
- Needs TXT and SRT output formats
---

## 4. Goals & Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| Lead generation | Unique visitors/month | 1,000+ within 3 months of launch |
| Engagement | Transcriptions completed | 70%+ of uploads result in a completed transcript |
| Trust signal | Average transcription accuracy | 90%+ (Whisper small model baseline) |
| Cost efficiency | Monthly hosting cost | < $5/month (static hosting) |
| SEO value | Organic search ranking | Page 1 for "free browser transcription tool" within 6 months |

---

## 5. Core Architecture

### 5.1 Client-Side Processing (Zero Server Cost)

See PRD for full architecture diagram.

### 5.2 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Transcription engine | @huggingface/transformers (transformers.js v3) | Runs Whisper models in-browser via WebGPU with WASM fallback. |
| Audio extraction | ffmpeg.wasm | Extracts audio from video containers entirely in-browser. |
| Frontend framework | React 18 + Vite | Fast dev experience, optimised builds. |
| Styling | Tailwind CSS | Rapid UI development, consistent design system. |
| Web Worker | Dedicated Worker thread | Keeps UI responsive during transcription. |
| Hosting | GCE (Cloud Storage + Load Balancer) or Cloudflare Pages | Static file hosting. |

### 5.3 Whisper Model Selection

Default: Whisper Small (~460 MB download, ~1 GB RAM, very good accuracy). Optional: Whisper Medium for higher accuracy.

### 5.4 Processing Pipeline

1. User drops file
2. Detect file type (video/audio)
3. ffmpeg.wasm extracts/resamples audio to 16kHz mono WAV
4. Load Whisper model (cached after first download)
5. Transcribe in Web Worker (30s chunks, real-time progress)
6. Post-process (merge chunks, generate timestamps)
7. Display results (plain text / timestamped / SRT)

---

## 6. Feature Specification (MVP)

- File Upload: Drag-and-drop + click-to-browse. Supports MKV, MP4, MOV, WebM, MP3, WAV, M4A, OGG, FLAC.
- Transcription Engine: Whisper Small (English-only MVP), WebGPU with WASM fallback, real-time output, cancel support, model caching.
- Output Panel: Plain Text / Timestamped / SRT toggle, one-click copy, download as .txt or .srt, editable inline, auto-scroll.
- UI/UX: Single-page app, responsive, Easier Agency branding, dark mode, no auth.
- Browser Compatibility: Chrome 113+ (full), Edge 113+ (full), Firefox (WASM only), Safari 18+ (full).

---

## 7. Non-Functional Requirements

- Time to interactive: < 2 seconds
- Model download (first use): < 30 seconds on 50 Mbps
- Transcription speed (WebGPU): 5-10x realtime
- Transcription speed (WASM): 1-3x realtime
- Memory usage: < 2 GB peak
- Zero data transmission - all processing in-browser
- No cookies beyond model cache
- Privacy badge visible on page

---

## 8. Hosting & Deployment

Option A: GCE Cloud Storage + Cloud CDN (~$0.50-2/month)
Option B: Cloudflare Pages (free, recommended)
Option C: Firebase Hosting (free tier)
Custom domain: transcribe.easieragency.com

---

## 9. Development Phases

Phase 1 (MVP): Project scaffolding, file upload, ffmpeg.wasm audio extraction, Whisper integration, real-time streaming, output formats, model caching, responsive layout, privacy badge, static build, deploy.

Phase 2 (Polish & SEO): Landing page content, FAQ, analytics, blog post, model selector, dark mode refinement.

Phase 3 (Power Features): Multi-language, speaker diarization, batch processing, keyboard shortcuts, shareable links, PWA support.

---

## 10. Key Technical Decisions

- transformers.js over whisper.cpp WASM (WebGPU support, active maintenance, model flexibility, community)
- Client-side over server-side API (cost, privacy, simplicity, speed to ship)
- Webapp over desktop app (zero friction, shareable, SEO, auto-updates)

---

## 11. Competitive Landscape

| Tool | Free Tier | Server-side? | Privacy | Accuracy |
|------|-----------|-------------|---------|----------|
| Otter.ai | 300 min/month | Yes | Data uploaded | Good |
| Descript | Limited | Yes | Data uploaded | Very good |
| TurboScribe | 3 files/day | Yes | Data uploaded | Very good |
| Easier Transcribe | Unlimited | No (client-side) | Nothing uploaded | Very good |

Our differentiators: truly unlimited, genuinely private, no account required, fast (WebGPU).
