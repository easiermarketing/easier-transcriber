# Chrome Web Store listing: Easier Transcribe

Ready to paste. Not submitted.

## Name

Easier Transcribe

## Short description (132 characters max)

Free transcripts for any video or audio on the page. YouTube captions in 2 seconds. Whisper on your device. Nothing uploaded.

## Category

Productivity

## Language

English

## Long description

Press the button on any page with a video or audio. See which is which. Pick one. Get the transcript.

It is free. No account. No paid plan. Nothing is uploaded.

HOW IT WORKS
1. Open a page with a video or audio.
2. Click the Easier Transcribe button.
3. Pick the one you want from the list. Each has its title and thumbnail.
4. The transcript opens in its own tab.

YOUTUBE: 1 TO 2 SECONDS
YouTube captions are read from the page you are already on, in your own signed-in browser. No bot check. No server in between.

EVERYTHING ELSE: WHISPER ON YOUR DEVICE
Video or audio files, podcasts, course videos, and YouTube videos with no captions are transcribed by Whisper, running on your own computer. Your audio never leaves it.

WHAT YOU GET
- Finds video and audio on the page, including players and YouTube embeds
- Shows the title, thumbnail and length of each, so you can tell them apart
- Saved history that survives a refresh and a restart. Open, search or delete any time
- Copy or download as text, text with times, SRT or VTT
- Start in Claude or Start in ChatGPT: opens the app with your transcript and a ready prompt for a summary and action items
- A small 80 MB model by default. A 500 MB "More accurate" model if you have a graphics chip

PRIVATE BY DESIGN
- No servers of ours. No analytics. No ads. No tracking.
- Your transcripts are saved in your browser only.
- The extension only looks at a page when you click its button.

GOOD TO KNOW
- The first Whisper run downloads the model once (about 80 MB). It is cached after that.
- Keep the results tab open while a transcript is working. You can use other tabs.
- The Whisper model is English only.
- Very long recordings need a lot of memory on your computer.
- Some players stream video in a way the browser will not hand over. They are listed, with a clear message.

Made by Easier Now. Questions: hello@easiernow.co

## Single purpose statement

Find the videos and audio on the page you are on, and turn the one you pick into a text transcript.

## Permission justifications

Paste each line into the matching field in the developer dashboard.

| Permission | Justification |
| --- | --- |
| activeTab | Lets the button read the page you clicked it on, and only then. It is how the extension finds the videos on that page. |
| scripting | Puts the video finder into the page when you click the button. Nothing runs on any page before that. |
| storage | Passes your pick from the popup to the results tab. The data is removed as soon as the tab takes it. |
| unlimitedStorage | Saves your transcripts and the Whisper model on your device. The model is up to 500 MB, more than the default limit. |
| Host: https://www.youtube.com/* | Reads YouTube captions for the video you pick, from your own session. Also needed for YouTube players embedded on other sites. |
| Host: https://i.ytimg.com/* | Shows YouTube thumbnails in the list. The results page is isolated for speed, which blocks images from hosts it has no access to. |
| Optional hosts: https://*/*, http://*/* | Not granted at install. Asked for only when you press a button that needs it, one prompt at a time: to look inside players from other sites, or to read a media file on a site the extension cannot reach yet. Chrome shows its own prompt. |
| Optional host: https://*.googlevideo.com/* (covered by the optional hosts above) | Asked for only for a YouTube video with no captions, to read its audio so Whisper can transcribe it. |
| Remote code | None. All code, ONNX Runtime and ffmpeg ship inside the extension. Content Security Policy is script-src 'self' 'wasm-unsafe-eval'. |

## Data use answers (dashboard form)

- Collects user data: No. Nothing is sent to the developer or any server of ours.
- Sold to third parties: No.
- Used for purposes unrelated to the single purpose: No.
- Used for creditworthiness or lending: No.
- Privacy policy: https://easier-transcribe.pages.dev/privacy/. It is live.

## Pictures, in upload order

Folder: `upload-ready/` next to this file. All 1280x800 unless noted.

1. `1-pick-a-video.png` (screenshot 1)
2. `2-transcript.png` (screenshot 2)
3. `3-export-srt.png` (screenshot 3)
4. `4-working.png` (screenshot 4)
5. `5-saved-history.png` (screenshot 5)
- Small promo tile, 440x280: `promo-tile-440x280.png`
- Marquee promo tile, 1400x560: `marquee-1400x560.png`
- Store icon 128x128: `icon128.png` (inside the zip too)

## Package

`easier-transcribe-extension-0.1.0.zip` (about 17 MB, manifest at the root).

## What the claims rest on

- "YouTube captions in 1 to 2 seconds": real YouTube video, real build, headless Chrome, text on screen in 1 to 2 seconds (`real-youtube-*.png`).
- "Nothing is uploaded": no server of ours is called; Whisper runs in the browser.
- Longest file tested: a 99 second, 560 MB video, first run on a phone-width page with the model download throttled to 12 Mbps. It finished in 106 to 118 seconds, model download included. Nothing longer has been run, so there is no claim of "no limit" and no claim of "ready in seconds" for Whisper jobs. The listing says very long recordings need a lot of memory.

## Notes for the team

- The pictures use the Easier cloud logomark and a recoloured frame of LPM Liquid Background 1.mp4 as the ink-in-water background (Easier Done confirmed the file).
- The screenshots use a public demo page, https://demo.easier-transcribe.pages.dev/ (a preview deploy, not production). No localhost shows.
