import React, { useState } from 'react';

// Optional email box shown after a result. It sends the address and nothing
// else: never the transcript, the file name or the link.
export default function EmailSignup() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [message, setMessage] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    setMessage('');
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), company: event.currentTarget.company?.value || '' }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "That didn't go through. Try again in a minute.");
      setState('done');
    } catch (error) {
      setState('error');
      setMessage(error.message);
    }
  };

  if (state === 'done') {
    return (
      <div className="bg-[var(--bg-soft)] p-6 rounded-[var(--r-m)] text-center" role="status">
        <p className="font-semibold mb-1">Thanks, you're on the list.</p>
        <p className="text-sm text-[var(--fg-muted)]">The setup steps will arrive by email. You can unsubscribe in 1 click.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-[var(--bg-soft)] p-6 rounded-[var(--r-m)]" noValidate>
      <label htmlFor="signup-email" className="block font-semibold mb-1">
        Want the setup steps and the odd tip by email?
      </label>
      <p className="text-sm text-[var(--fg-muted)] mb-4">Free. We never email your transcript.</p>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          id="signup-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 min-w-0 px-4 py-3 rounded-full bg-[var(--bg)] border border-white/20 text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:outline-none focus:border-[var(--brand)]"
        />
        {/* Hidden from people; bots fill it in. */}
        <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <button
          type="submit"
          disabled={state === 'sending'}
          className="px-6 py-3 rounded-full font-semibold bg-[var(--brand-fill)] hover:bg-[var(--brand-hover)] text-[var(--on-brand)] disabled:opacity-60"
        >
          {state === 'sending' ? 'Sending...' : 'Email me'}
        </button>
      </div>

      {state === 'error' && (
        <p className="text-sm text-[var(--bad)] mt-3" role="alert">
          {message}
        </p>
      )}
      <p className="text-xs text-[var(--fg-faint)] mt-3">
        We keep only your email address, from Easier Now. Replies go to a real person. Unsubscribe any time.
      </p>
    </form>
  );
}
