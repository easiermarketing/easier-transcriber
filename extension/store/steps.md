# Try it in Chrome on Windows

The built extension is in this folder:

`C:\Users\astra\Documents\GitHub\easier-transcriber\.claude\worktrees\agent-a092ecd76b5ca2182\extension\dist`

It is already built. If the folder is missing, open a terminal in `C:\Users\astra\Documents\GitHub\easier-transcriber\.claude\worktrees\agent-a092ecd76b5ca2182` and run `npm run build:extension`. It takes about 10 seconds.

One honest note: the automated tests could not press the real toolbar button. Step 7 is the first time that click happens. If the list is empty on a page that plainly has a video, tell me.

## Steps

1. Open Chrome. In the address bar type `chrome://extensions` and press Enter.
   You see the Extensions page with a grey background and a list of cards.

2. Turn on **Developer mode**. The switch is at the top right of the page.
   It turns blue. A row of buttons appears at the top left: Load unpacked, Pack extension, Update.

3. Click **Load unpacked**.
   A Windows folder picker opens.

4. Paste the dist path above into the folder box, press Enter, then click **Select Folder**.
   A new card appears: Easier Transcribe, version 0.1.0, with a purple icon and its switch on. No red Errors button on the card.

5. Click the **puzzle piece** icon in the toolbar, to the right of the address bar.
   A small list opens. Easier Transcribe is in it.

6. Click the **pin** icon next to Easier Transcribe, then click anywhere else to close the list.
   The purple Easier Transcribe icon now sits in the toolbar.

7. Open a page with a video. A YouTube video that has captions is the quickest test. Then click the purple icon.
   A small window opens, titled "Pick what to transcribe". It says "Found 1 on this page" or more. Each row has a thumbnail, a title, the length, and a purple **Transcribe** button. The video playing is first.

8. Click **Transcribe** on the video.
   A new tab opens named Easier Transcribe, and the small window closes. For YouTube, the text appears in 1 to 2 seconds. A purple tag says "YouTube captions". Your video is also in the list on the left.

9. Try a video that is not on YouTube, or a YouTube video with no captions. Pick it the same way.
   A progress bar shows. The first time it says "Getting Whisper ready. First time only, about 80 MB." After that it says "Transcribing on your processor", and the text fills in as it goes. When it ends, the tag says "Whisper on this device".

10. Test saving and export. Press F5 to refresh the tab, close it, then click the icon and choose "Open my saved transcripts".
    Your transcripts are still on the left. Click the tabs Text, With times, SRT and VTT to change the view. Copy puts it on the clipboard. Download saves a file. Delete removes it after you confirm.

## What failed looks like

- Small window says "This page can't be scanned": you are on a Chrome page (chrome://, the Web Store). Open a normal page.
- "No video or audio found": the page has none in plain view. A player from another site may show a "Look inside them" button. Chrome then asks for permission. That button has not been tried by hand yet.
- A job says "Allow and try again": the video lives on a site the extension cannot reach yet. Click it and approve Chrome's prompt.
