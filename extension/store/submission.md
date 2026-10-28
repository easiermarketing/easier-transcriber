# Store submission: what is ready and what is Anthony's

Nothing has been paid, submitted or opened in the store.

## Ready
- Package: `extension/dist` zipped by `npm run build:extension` (zip it from the folder, manifest at the root).
- Listing words, category (Productivity), single purpose, permission reasons, data answers: `listing.md`.
- 5 screenshots 1280x800 and the 440x280 tile: this folder. Marquee 1400x560 is optional and not made.
- Privacy policy text: `privacy.md`. The public page is built (branch feat/privacy-page, preview https://privacy-preview.easier-transcribe.pages.dev/privacy/).
- Real-click evidence: `real-youtube-*.png` (headless Chrome, real build, popup opened as the toolbar does).

## Not ready, needs a typed line from Anthony
1. Production deploy so https://easier-transcribe.pages.dev/privacy/ is public (merge feat/privacy-page into main).
2. Developer sign-up and the $5 payment (his card, his Google account).
3. The final Submit.

## Visit plan (about 10 minutes)
1. Sign in to the Chrome Web Store developer dashboard, pay $5.
2. New item, upload the zip.
3. Paste fields from `listing.md`, upload the screenshots and tile.
4. Privacy tab: paste the permission reasons and data answers, set the privacy URL.
5. Submit for review.

## Honest limits of testing
- The headless run could not press the real toolbar button. A script-opened popup has no activeTab grant, so on plain websites it says it cannot scan the page. On YouTube it works because youtube.com access is granted at install.
- Non-YouTube pages are tested in a test build that has access to 127.0.0.1. The real click on such a page is first tried at the Load unpacked test.
- The e2e check "mkv goes through bundled ffmpeg" failed with a 404 from a missing fixture file, not an extension fault.
