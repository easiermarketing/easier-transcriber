/**
 * What the page does when the YouTube lookup on our server fails.
 *
 * YouTube often refuses requests from cloud servers ("confirm you're not a
 * bot"). That is its call and we don't work around it. The free helper on the
 * visitor's own computer asks YouTube from their home connection, so when it
 * is already running the page uses it straight away instead of asking the
 * visitor to click first.
 */

// YouTube problems the free helper can usually get around.
export const HELPER_CAN_HELP = {
  no_captions: 'This video has no captions.',
  blocked: "YouTube wouldn't share this video's captions with us just now.",
  rate_limited: 'YouTube is busy and asked us to slow down.',
  unavailable: "We couldn't reach YouTube just now.",
  login_required: 'YouTube wants a sign-in before it shares this video.',
};

/** 'helper-now' | 'helper-panel' | 'error' */
export async function chooseFallback(code, isHelperRunning) {
  if (!HELPER_CAN_HELP[code]) return 'error';
  return (await isHelperRunning()) ? 'helper-now' : 'helper-panel';
}
