# Easier Transcribe, the Chrome extension

Press the toolbar button on any page with a video or audio. See which is which. Pick one. Get the transcript.

- YouTube: the captions are read from the page you are on, in your own signed-in browser. About a second. No bot check, no server.
- Everything else, and YouTube videos with no captions: Whisper runs on your device.
- Nothing is sent to our servers. There are none in this extension.
- Transcripts are saved on your device (IndexedDB). They survive a refresh and closing the browser. Open, copy, download (text, with times, SRT, VTT) or delete them in the results tab.

## Build and load

```
npm install
npm run build:extension
```

Then open `chrome://extensions`, turn on Developer mode, press Load unpacked and pick `extension/dist`.

Check it end to end (needs Chrome, ffmpeg and a short speech clip, see the top of `test/e2e.mjs`):

```
EXT_TEST=1 npm run build:extension      # builds extension/dist-test, which also trusts http://127.0.0.1
FIXTURES=<folder> node extension/test/e2e.mjs
node extension/test/youtube.mjs         # live YouTube captions check
```

## How it works

| Part | File | Job |
| --- | --- | --- |
| Popup | `src/popup.*` | Injects the scanner into the current tab, lists what it finds with titles and thumbnails, sends the pick on. |
| Scanner and caption reader | `src/content.js` | Runs in the page. Finds `<video>`, `<audio>`, links to media files, YouTube embeds and links. Reads YouTube captions through the page's own session. Hands over media bytes for files only the page can reach. |
| Service worker | `src/background.js` | Queues the pick and opens, or brings forward, the one results tab. |
| Results tab | `src/results.*`, `src/lib/runner.js` | Runs the job (captions, or download, decode, Whisper), saves every step to IndexedDB, shows history. |
| Whisper | `src/whisper.worker.js` | The website's own worker (`src/workers/transcriber.worker.js`), unchanged apart from where it finds ONNX Runtime. |

Whisper runs in the results tab, not in the service worker, because a service worker is stopped after a few seconds. A normal tab keeps going until you close it. While a job runs, keep the tab open. You can look at other tabs.

Models: the small 80 MB `whisper-base.en` on your processor by default. The "More accurate" switch (same one as the website) uses the 500 MB `whisper-small.en` on your graphics chip when there is one. The model is downloaded once from Hugging Face and cached by the browser. The ONNX Runtime and ffmpeg files ship inside the extension, because extensions cannot run code from a CDN.

The model is English only, as on the website.

## Permissions, and why

| Permission | Why |
| --- | --- |
| `activeTab` | Lets the button read the page you pressed it on, only then. This is how the scanner reaches pages without a blanket "all sites" permission. |
| `scripting` | Injects the scanner into that page (and its frames) when you press the button. Nothing runs on pages until you do. |
| `storage` | A small queue that hands a pick from the popup to the results tab. |
| `unlimitedStorage` | Transcripts are saved in IndexedDB and Whisper's model is cached. The default quota is too small for the 500 MB model. |
| `https://www.youtube.com/*` (host) | Read captions through the page for YouTube watch pages, and for YouTube players embedded on other sites. |
| `https://i.ytimg.com/*` (host) | Show YouTube thumbnails in the popup. The results tab is cross-origin isolated (faster Whisper), which blocks images that are not from a host the extension has access to. |
| `https://*/*`, `http://*/*` (optional host) | Not granted at install. Asked for only when you press a button that needs it: "Look inside them" for players from other sites, or "Allow and try again" when a media file lives on a site the extension cannot reach yet. Chrome shows its own prompt each time. YouTube audio for videos with no captions asks for `*.googlevideo.com` the same way. |

No `tabs`, `history`, `cookies`, `webRequest`, `downloads` or `contextMenus` permission. No remote code. Content Security Policy is `script-src 'self' 'wasm-unsafe-eval'`.

The results tab sets `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` in the manifest so Whisper can use several threads.

## What it cannot do

- Players that stream through `blob:` and Media Source (many social sites). The browser does not hand the file over. The popup lists them, and the job stops with a plain message.
- YouTube videos with no captions rely on YouTube giving out an unprotected audio stream. It often does not. The job then says so.
- Players inside iframes from other sites need the "Look inside them" permission.
- Long files: audio is decoded in memory. Very long recordings need a lot of RAM.
- Non-English speech with no YouTube captions (the small model is English only).

## Not done yet

- Chrome Web Store listing, privacy policy text and screenshots.
- Poppins is used only if it is installed. The pages do not load web fonts.
