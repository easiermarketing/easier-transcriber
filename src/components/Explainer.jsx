import React from 'react';

const steps = [["Add a file or paste a link", "Video or audio. A YouTube link works too."], ["Wait for the text", "The first time takes a little longer while the speech model downloads once."], ["Copy it or save it", "Text, text with times, SRT or VTT."]];

const faqs = [["Is it free?", "Yes. No plan to pay for and no account to make."], ["Is my recording uploaded?", "No. A file you pick is never uploaded. It is turned into text in your browser, on your own computer. Two things do reach us: if you paste a YouTube link, our page function receives the video ID and asks YouTube for the captions (we store and log nothing, though Cloudflare, who host the site, may cache the caption text for up to 30 minutes), and if you join the email list, we receive the address you type. The privacy page has the detail."], ["How long does it take?", "The first run includes a one-off download of the speech model (80 MB by default). In our test, a 99 second video on a slow connection took 106 to 118 seconds including that download. Very long recordings need a lot of memory, so a very long file may not finish."], ["What can I save?", "Text, text with times, SRT and VTT."], ["What languages does it handle?", "Files are transcribed in English only. YouTube captions come in the language the video has."]];

export default function Explainer() {
  return (
    <section className="mb-12 space-y-8" aria-labelledby="how-heading">
      <div>
        <h2 id="how-heading" className="text-2xl font-bold mb-4">How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {steps.map(([title, body], i) => (
            <li key={title} className="bg-[var(--card)] border border-[var(--line-soft)] p-4 rounded-[var(--r-m)]">
              <p className="font-semibold mb-1">{i + 1}. {title}</p>
              <p className="text-sm text-[var(--fg-muted)]">{body}</p>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-3">Questions</h2>
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
