# Privacy policy: Easier Transcribe

Draft. Not published. Last updated: 28 October 2026.

Easier Transcribe is a Chrome extension made by Easier Now.
Questions: hello@easiernow.co

## The short version

- We run no servers for this extension. We receive nothing from it.
- No account, no analytics, no ads, no tracking.
- Your transcripts are saved in your own browser. Only you can see them.
- Whisper runs on your device. Your audio is not uploaded.

## What the extension looks at

It looks at a page only when you click its button.
Then it reads the page for video and audio: titles, addresses, poster images, lengths, and links to YouTube videos and media files.
This stays on your device. It is used to build the list you pick from.

## What is saved on your device

- Your transcripts: the title, the address of the video, a thumbnail address or small still, the text with times, the date, and the method used. Stored in the browser's own storage for this extension (IndexedDB).
- Your choice of the "More accurate" switch. Stored in the extension's local storage.
- A short-lived note that passes your pick from the popup to the results tab. It is removed as soon as the tab takes it.
- The Whisper model files, kept in the browser's cache so they download once.

You can delete one transcript or all of them in the results tab. Removing the extension removes everything it saved.

## Where the extension connects

Only to these, and only to do what you asked:

1. youtube.com. When you pick a YouTube video, it asks YouTube for that video's captions. This runs from the page you are on, using your own signed-in session, or from the extension for players embedded on other sites. YouTube sees an ordinary request for that video's captions. Their privacy policy applies to that.
2. i.ytimg.com. YouTube thumbnails shown in the list.
3. The site the video or audio is on. When you pick a file, the extension downloads it from where it already lives, with your session on that site. Poster images are loaded from the same site.
4. huggingface.co. The first time you use Whisper, it downloads the model files (about 80 MB, or about 500 MB with "More accurate"). Hugging Face sees a normal file download. No audio or text is sent. Their privacy policy applies.
5. googlevideo.com. Only for a YouTube video that has no captions, and only if you allow it when Chrome asks. The extension downloads that video's audio so Whisper can transcribe it on your device.

Nothing else. The code that runs Whisper, ONNX Runtime and ffmpeg ship inside the extension. It loads no code from the internet.

## What we do not do

- We do not collect, store, sell or share your data. We never receive it.
- We do not use cookies or identifiers of our own.
- We do not read your browsing history or watch pages you have not clicked the button on.
- We do not use your data for ads, credit or lending.

## Permissions

The reasons for each permission are in the store listing. In short: read the page you clicked on, save your transcripts, and read YouTube captions.

## Children

The extension is not aimed at children and collects nothing from anyone.

## Changes

If this policy changes, the date above changes, and the new version ships with the extension update.

## Contact

Easier Now, hello@easiernow.co
