# Competitors: Chrome transcript extensions

Researched 28 Oct 2026. Read-only desk research.

Method note:
- chromewebstore.google.com redirects WebFetch to a Google consent page. No store page could be read directly.
- Figures below come from review write-ups and listing trackers. Treat counts as rough.
- Anything not confirmed is marked unverified with the source tried.

## Comparison

| # | Extension | Users | Rating | Price / free limit | Non-YouTube video | On-device or upload | Export | History |
|---|-----------|-------|--------|--------------------|-------------------|---------------------|--------|---------|
| 1 | Tactiq | ~1,000,000 (tracker) | ~4.8, ~3.9k to 4.2k ratings (trackers differ); Trustpilot 3.2 from 15 | Free: 10 transcripts and 5 AI credits per month. Paid from ~$8/mo annual | Meet, Zoom, Teams, YouTube. Other pages unverified | Reads live captions from the page, not audio. Cloud account | Google Docs, Notion, Slack, PDF; copy | Yes, cloud dashboard |
| 2 | YouTube Summary & ChatGPT by Glasp | ~100,000 (audit site) | ~3.9 from ~180 ratings (another snapshot: 3.3 from ~590) | Free transcript and summary; account for some features | No. YouTube focus | Uses YouTube caption data, then sends text to an AI | Copy; send to ChatGPT, Claude, Gemini; highlights to Notion, Obsidian | Via Glasp account (cloud) |
| 3 | Notta | Unverified (store page blocked) | Store rating unverified. Company page on a review site: 1.4 from 157 | Free: 120 min/mo, 3 min per recording. Pro $13.99/mo or ~$8.17 annual | Yes: tab capture for webinars, podcasts, recordings | Uploads audio to cloud | Unverified (Notta site not fetched) | Yes, cloud |
| 4 | Otter.ai | Unverified. 143 store reviews (extscope) | Store score unverified. Trustpilot 3.0 from 565 | Free: 300 min/mo, 30 min per chat, 3 lifetime imports. Paid ~$8.33/mo annual | Meet, Zoom, Teams, web audio | Uploads audio to cloud | Unverified | Yes, cloud |
| 5 | YouTube Transcript (generic class, e.g. the 500k user one) | ~500,000 (notelm roundup, unnamed dev) | ~4.5 | Free, no account | No | No audio. Reads existing captions only | TXT, SRT; copy with or without timestamps | No (unverified) |

Also seen, not in top 5:
- NoteGPT: free transcript plus summary, 15 AI uses per month, can handle videos without captions.
- YT Scribe: timestamped transcript, ~$4.99/mo.
- Eightify: summaries only, no free tier beyond 7 day trial.
- Transcript Buddy: search and copy, no export.
- Maestra: unverified. No extension data found (WebSearch, fireflies.ai roundup).
- Descript: no Chrome transcription extension found. Unverified.
- Whisper in browser: no store extension matching "on-device, any page media" found. Seen instead:
  - Whisper Web (web app, not extension, local, takes files and mic).
  - hush (GitHub, Whisper on WebGPU, mic only).
  - QuickWhisper (extension that hands URLs to a Mac app).
  - Whisper Library Meeting Transcriber (meeting detect, hands off to a local app).
  So the on-device any-page niche looks open. Unverified for the live store.

## Permissions (rough)

- Tactiq: medium risk per extscope. Host access for meeting sites and YouTube, tab audio and identity. Exact list unverified.
- Glasp YouTube Summary: medium risk per extensionauditor. Exact list unverified. Its sister Web Highlighter asks for all sites, so check before assuming.
- Notta, Otter: tab capture and all-site access likely. Exact lists unverified.
- Generic transcript extractors: usually YouTube host access only. Some show medium risk on extscope. Unverified per listing.

## Top 3 complaints per extension (paraphrased)

Tactiq (Trustpilot and review sites, not store reviews):
1. Billing surprises, charged after expecting free.
2. Free limit of 10 transcripts feels tight, AI paused after cap.
3. Speaker labels need manual fixing, quality tied to the page captions.

Glasp YouTube Summary (thin data, unverified):
1. Account and extras feel pushy.
2. Summary panel feels intrusive on the watch page.
3. Mixed ratings, reasons not readable. Source: extensionauditor, store snapshot.

Notta (company reviews, not extension):
1. Trial converted to a paid charge.
2. Support slow to reply.
3. Free tier cap of 3 min per recording. Source: fireflies roundup.

Otter (G2, Trustpilot):
1. Accuracy drops with accents, noise, overlapping voices.
2. Slow support and hard to cancel.
3. Free minute and import caps. English strongest.

Generic YouTube Transcript extensions:
1. Stops working when YouTube changes its page.
2. "No transcript" on videos without captions.
3. Few languages, plain formatting, no AI or summary.

## Gaps for Easier Transcribe

Ranked by how much they matter. Effort is a guess.

1. Reliability when YouTube changes. Top complaint class. Needs a fallback chain: page data, then caption track URL, then Whisper on the audio. Effort: M, mostly tests.
2. Videos with no captions. Competitors either fail or upload audio. Our Whisper fallback is the edge. Make it automatic, with a clear "no captions, transcribing now" state. Effort: S if wired already.
3. No account, no limits, no surprise charge. Say it on the first screen and in the listing. Effort: XS.
4. Timestamps on or off in copy and export. Generic tools sell this. Effort: S.
5. Speaker labels. Tactiq, Otter and Notta have them, users still fix by hand. Whisper has none. Skip for v1, say so. Effort: L.
6. Search inside a transcript and across history. Transcript Buddy and Glasp offer in page search. Effort: S in page, M across history.
7. Language choice and translation. Notta pitches 58 languages. Whisper multilingual covers input. Add a language picker and "auto". Translation: L, skip. Effort: S.
8. Summary and Ask AI. Glasp, NoteGPT, Tactiq sell it. Our Start in Claude/ChatGPT button covers this without keys. Add a prompt choice (summary, action items, quotes). Effort: S.
9. More exports. Docs, Notion, PDF, Markdown. Add MD and DOCX or PDF later. Effort: S for MD, M for PDF.
10. Long media and speed. Notta and Otter cap length, so long files are a pull. Show progress, allow pause and resume, chunk memory. Effort: M.
11. Meeting capture (Meet, Zoom, Teams). Tactiq's core. Different product, privacy and permission cost. Do not chase. Effort: L.
12. Cross device sync. Cloud tools win here. Offer manual export and import of history JSON instead. Effort: S.
13. Clear permission story. Trackers flag medium risk for rivals. Ask for the least host access, optional host permissions per site, explain each in the listing. Effort: S.
14. Editing the transcript text before export. Glasp offers edit and highlight. Effort: M.

## Source list

- fireflies.ai/blog/transcript-extensions (limits and prices)
- notelm.ai/blog/youtube-transcript-chrome-extension (vendor biased, user count and complaint class)
- extensionauditor.com and extscope.org (Glasp, Tactiq tracker data)
- tactiq.io pricing and help center via search
- G2 and Trustpilot snippets via search (Otter, Notta, Tactiq)
