/**
 * Talks to the free Easier Transcribe helper (`npx easier-transcribe serve`)
 * running on the visitor's own computer. The website only uses it for what a
 * browser can't do alone, like transcribing the audio of a YouTube video that
 * has no captions. Nothing goes to our servers either way.
 */

export const HELPER_URL = 'http://127.0.0.1:17748';
export const HELPER_COMMAND = 'npx easier-transcribe serve';

export async function isHelperRunning() {
  try {
    const response = await fetch(`${HELPER_URL}/health`, { signal: AbortSignal.timeout(2000) });
    // Make sure it's our helper, not something else using the same port.
    return response.ok && (await response.json()).name === 'easier-transcribe';
  } catch {
    return false;
  }
}

export async function transcribeWithHelper(source, { onProgress, signal } = {}) {
  let response = await fetch(`${HELPER_URL}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, wait_seconds: 3 }),
    signal,
  });
  let body = await response.json();

  const cancel = () => body.job_id && fetch(`${HELPER_URL}/jobs/${body.job_id}`, { method: 'DELETE' }).catch(() => {});
  signal?.addEventListener('abort', cancel, { once: true });

  try {
    while (response.status === 202) {
      onProgress?.({ progress: body.progress || 0, message: body.message });
      response = await fetch(`${HELPER_URL}/jobs/${body.job_id}?wait=5`, { signal });
      body = await response.json();
    }
  } finally {
    signal?.removeEventListener('abort', cancel);
  }

  if (!response.ok) throw new Error(body.error || "The helper couldn't transcribe this.");
  return { ...body.transcript, via: 'helper' };
}
