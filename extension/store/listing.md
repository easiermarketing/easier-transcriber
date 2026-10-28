# Chrome Web Store listing: Easier Transcribe

Draft. Not submitted.

## Name

Easier Transcribe

## Short description (132 characters max)

Free transcripts for any video or audio on the page. YouTube captions in 1 second. Whisper on your device. Nothing uploaded.

## Category

Productivity

## Language

English

## Long description

Press the button on any page with a video or audio. See which is which. Pick one. Get the transcript.

It is free. No account. No limits. No paid plan. Nothing is uploaded.

HOW IT WORKS
1. Open a page with a video or audio.
2. Click the Easier Transcribe button.
3. Pick the one you want from the list. Each has its title and thumbnail.
4. The transcript opens in its own tab.

YOUTUBE: 1 SECOND
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
- Privacy policy: https://easier-transcribe.pages.dev/privacy/ (the page is built on branch feat/privacy-page and goes live with the next production deploy, which needs Anthony's typed line).

## Notes for the team

- Screenshots (1280x800) and the 440x280 small promo tile are in this folder. The marquee tile (1400x560) is optional and not made.
- The page address shown in the screenshots is a local demo page.
