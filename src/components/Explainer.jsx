import React from 'react';

const steps = [
  ['Drop in the file', 'Drag the recording onto the box, or press it and pick the file. Video and audio both work. The file stays on your device. Nothing is sent to us.'],
  ['Wait for the first run to get ready', 'The first time, your browser downloads the speech model once. The default model is 80 MB. On a computer with a graphics chip there is a more accurate 500 MB option. After that it is saved in your browser, so the next file starts straight away.'],
  ['Watch the text appear', 'The words fill in as the recording is read. Keep the tab open until it finishes. You can use other tabs.'],
  ['Copy it or save it', 'Copy the text, or download it as text, text with times, SRT or VTT. SRT and VTT are the subtitle formats video editors read.'],
];

const faqs = [
  ['Is it really free?', 'Yes. There is no plan to pay for and no account to make.'],
  ['Is my recording uploaded?', 'No. A file you pick is never uploaded: Whisper runs in your browser on your own computer, and we do not receive your file or your text. Two things do reach us. If you paste a YouTube link, our page function receives the video ID and asks YouTube for the captions. We store and log nothing, though Cloudflare, who host the site, may keep the caption text in its cache for up to 30 minutes. If you choose to join the email list, we receive the address you type. The privacy page has the detail.'],
  ['How long does it take?', 'The first run includes a one-off model download. In our test, a 99 second video on a slow connection took 106 to 118 seconds including that download. Longer files take longer.'],
  ['How long a file can I use?', 'We have tested one file, 99 seconds long. Very long recordings need a lot of memory on your computer, so a very long file may not finish. We have not set a limit.'],
  ['What languages does it handle?', 'The Whisper models we use are English only. YouTube captions come in the language the video has.'],
  ['Which formats can I save?', 'Text, text with times, SRT and VTT.'],
  ['Who makes it?', 'Easier Now. Questions: hello@easiernow.co.'],
];

export default function Explainer() {
  return (
    <section className="mb-12 space-y-8" aria-labelledby="how-heading">
      <div>
        <h2 id="how-heading" className="text-2xl font-bold mb-2">You recorded a call. Now you need the words.</h2>
        <p className="text-[var(--fg-muted)]">
          You had a call with a client and agreed three things. You do not want to rely on memory. You could type it out, or you could upload the recording to a stranger's server. There is a third way: turn it into text on your own computer. Here is how, using that recording.
        </p>
      </div>

      <ol className="space-y-4">
        {steps.map(([title, body], i) => (
          <li key={title} className="bg-[var(--card)] border border-[var(--line-soft)] p-5 rounded-[var(--r-m)]">
            <h3 className="font-semibold mb-1">Step {i + 1}: {title}</h3>
            <p className="text-sm text-[var(--fg-muted)]">{body}</p>
          </li>
        ))}
      </ol>

      <div className="bg-[var(--card)] border border-[var(--line-soft)] p-5 rounded-[var(--r-m)]">
        <h3 className="font-semibold mb-1">A real run, so you know what to expect</h3>
        <p className="text-sm text-[var(--fg-muted)]">
          We tested a video 99 seconds long and 560 MB in size, on a slow connection (throttled to 12 Mbps), with nothing saved from before. The model download and the transcript together took between 106 and 118 seconds. The first run costs a one-off download. Every run after it costs only the reading time.
        </p>
      </div>

      <div>
        <h3 className="font-semibold mb-1">Got a YouTube link instead?</h3>
        <p className="text-sm text-[var(--fg-muted)]">
          Paste the link. If the video has captions and YouTube lets us read them, the text arrives in 1 to 2 seconds. If not, the file route above does the work.
        </p>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-3">Questions people ask</h2>
        <div className="space-y-3">
          {faqs.map(([q, a]) => (
            <details key={q} className="bg-[var(--card)] border border-[var(--line-soft)] p-4 rounded-[var(--r-m)]">
              <summary className="font-semibold cursor-pointer">{q}</summary>
              <p className="text-sm text-[var(--fg-muted)] mt-2">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
