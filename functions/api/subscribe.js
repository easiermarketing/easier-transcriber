/**
 * POST /api/subscribe   { "email": "you@example.com" }
 *
 * Cloudflare Pages Function behind the optional email box. It receives an
 * address and nothing else, and sends no email itself.
 *
 * With RESEND_API_KEY and RESEND_AUDIENCE_ID set, it adds the address to the
 * Resend audience that the welcome sequence reads. Without them (previews),
 * it checks the address and stores nothing.
 */

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'That did not look like an email address.' }, 400);
  }

  // Filled in only by bots. Pretend it worked.
  if (body.company) return json({ ok: true });

  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) {
    return json({ error: "That doesn't look like an email address. Check it and try again." }, 400);
  }

  if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) {
    // Preview addresses accept and drop the address so the box can be tried.
    // The real site refuses, so nobody is told they're on a list that doesn't exist.
    const live = ['transcribe.easiernow.co', 'easier-transcribe.pages.dev'].includes(new URL(request.url).hostname);
    if (live) return json({ error: "Sign-up isn't open yet. Try again soon." }, 503);
    return json({ ok: true, stored: false });
  }

  const response = await fetch(`https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, unsubscribed: false }),
  });
  if (!response.ok) return json({ error: "That didn't go through. Try again in a minute." }, 502);
  return json({ ok: true, stored: true });
}
