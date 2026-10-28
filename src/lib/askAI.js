// "Start in Claude" / "Start in ChatGPT": open the AI app with a ready-made
// prompt. Links carry the prompt in the address, which only fits a short
// transcript. For longer ones the transcript goes on the clipboard and the
// prompt asks the app to wait for it.

const MAX_LINK_CHARS = 6000;

export const AI_APPS = {
  claude: { name: 'Claude', url: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}` },
  chatgpt: { name: 'ChatGPT', url: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}` },
};

const ASK = 'Summarise it in 5 bullet points, then list any decisions and action items with who owns them.';

export function buildAskPrompt(text, title) {
  const heading = title ? `This is a transcript of "${title}".` : 'This is a transcript.';
  if (text.length <= MAX_LINK_CHARS) {
    return { prompt: `${heading} ${ASK}\n\n${text}`, needsPaste: false };
  }
  return {
    prompt: `${heading} I'm about to paste it as my next message. Wait for it, then ${ASK.charAt(0).toLowerCase()}${ASK.slice(1)}`,
    needsPaste: true,
  };
}
