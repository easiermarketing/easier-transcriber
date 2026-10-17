import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTranscript, toSRT, toVTT, toPlainText, toTimestamped, clock } from '../src/formats.js';
import { parseYouTubeId, isYouTubeUrl, parseJson3, parseTimedTextXml, pickTrack } from '../src/youtube.js';
import { SAMPLE_RATE, splitAtQuietPoints, toSegments, dropRepeats, isSilent } from '../src/blocks.js';

const segments = [
  { start: 0, end: 2.5, text: 'Hello there.' },
  { start: 2.5, end: 61.25, text: 'Second line' },
  { start: 65, end: 3725.5, text: 'After a pause.' },
];

test('SRT uses HH:MM:SS,mmm and numbered cues', () => {
  assert.equal(
    toSRT(segments),
    '1\n00:00:00,000 --> 00:00:02,500\nHello there.\n\n' +
      '2\n00:00:02,500 --> 00:01:01,250\nSecond line\n\n' +
      '3\n00:01:05,000 --> 01:02:05,500\nAfter a pause.'
  );
});

test('VTT has a header and dot milliseconds', () => {
  assert.ok(toVTT(segments).startsWith('WEBVTT\n\n00:00:00.000 --> 00:00:02.500\nHello there.'));
});

test('cues never overlap and never end before they start', () => {
  const srt = toSRT([
    { start: 1, end: 5, text: 'a' },
    { start: 3, end: null, text: 'b' },
  ]);
  assert.match(srt, /00:00:01,000 --> 00:00:03,000\na/);
  assert.match(srt, /00:00:03,000 --> 00:00:06,000\nb/);
});

test('long subtitles split at word boundaries, sharing the time', () => {
  const srt = toSRT([{ start: 10, end: 20, text: 'one two three four five six seven eight' }], { maxChars: 20 });
  assert.equal(
    srt,
    '1\n00:00:10,000 --> 00:00:14,737\none two three four\n\n' + '2\n00:00:14,737 --> 00:00:20,000\nfive six seven eight'
  );
  assert.equal(toSRT(segments, { maxChars: 200 }), toSRT(segments));
});

test('plain text starts a new paragraph after a 3 second pause', () => {
  assert.equal(toPlainText(segments), 'Hello there. Second line\n\nAfter a pause.');
});

test('timestamped and json formats', () => {
  assert.equal(toTimestamped(segments).split('\n')[2], '[00:01:05] After a pause.');
  const json = JSON.parse(formatTranscript({ title: 't', segments }, 'json'));
  assert.equal(json.text, toPlainText(segments));
  assert.equal(clock(3725.9), '01:02:05');
});

test('parses every common YouTube link shape', () => {
  const id = 'arj7oStGLkU';
  for (const link of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=42s`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://music.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube.com/live/${id}`,
    `youtube.com/watch?v=${id}`,
    id,
  ]) {
    assert.equal(parseYouTubeId(link), id, link);
  }
  assert.equal(parseYouTubeId('https://vimeo.com/123'), null);
  assert.equal(parseYouTubeId('https://www.youtube.com/@channel'), null);
  assert.equal(isYouTubeUrl('C:/videos/arj7oStGLkU'), false);
});

test('json3 captions become segments, with word timings for auto captions', () => {
  const { segments: parsed, words } = parseJson3({
    events: [
      { tStartMs: 0, dDurationMs: 4000, wWinId: 1 },
      { tStartMs: 1000, dDurationMs: 3000, segs: [{ utf8: 'hello' }, { utf8: ' world', tOffsetMs: 600 }] },
      { tStartMs: 2500, dDurationMs: 10, aAppend: 1, segs: [{ utf8: '\n' }] },
      { tStartMs: 3000, dDurationMs: 2000, segs: [{ utf8: 'again' }] },
    ],
  });
  assert.deepEqual(parsed, [
    { start: 1, end: 3, text: 'hello world' },
    { start: 3, end: 5, text: 'again' },
  ]);
  assert.deepEqual(
    words.map((w) => [w.text, w.start, w.end]),
    [
      ['hello', 1, 1.6],
      ['world', 1.6, 3],
      ['again', 3, 5],
    ]
  );
});

test('older XML captions, with entities decoded', () => {
  const { segments: parsed } = parseTimedTextXml(
    '<transcript><text start="1.5" dur="2">It&amp;#39;s &lt;fine&gt;</text><text start="4" dur="1">Rock &amp; roll</text></transcript>'.replace('&amp;#39;', '&#39;')
  );
  assert.deepEqual(parsed, [
    { start: 1.5, end: 3.5, text: "It's <fine>" },
    { start: 4, end: 5, text: 'Rock & roll' },
  ]);
});

test('track choice prefers human captions in the asked-for language', () => {
  const tracks = [
    { languageCode: 'en', kind: 'auto' },
    { languageCode: 'de', kind: 'manual' },
    { languageCode: 'en-GB', kind: 'manual' },
  ];
  assert.equal(pickTrack(tracks, 'en').languageCode, 'en-GB');
  assert.equal(pickTrack(tracks, 'de').languageCode, 'de');
  assert.equal(pickTrack(tracks, 'fr').languageCode, 'en-GB');
  assert.equal(pickTrack([], 'en'), null);
});

test('audio splits at the quietest point near each block boundary', () => {
  const seconds = 300;
  const samples = new Float32Array(seconds * SAMPLE_RATE).map((_, i) => Math.sin(i / 5) * 0.3);
  // A short silence at 118s: the first cut should land inside it.
  samples.fill(0, 118 * SAMPLE_RATE, 118.3 * SAMPLE_RATE);
  const blocks = splitAtQuietPoints(samples, 120);
  const firstCut = blocks[0].end / SAMPLE_RATE;
  assert.ok(firstCut > 118 && firstCut < 118.3, `cut at ${firstCut}`);
  assert.equal(blocks.at(-1).end, samples.length);
  blocks.forEach((b, i) => i && assert.equal(b.start, blocks[i - 1].end));
  assert.ok(isSilent(new Float32Array(16000)));
});

test('Whisper chunks are moved onto the recording clock', () => {
  const result = { chunks: [{ text: ' Hi', timestamp: [0, 1.5] }, { text: ' there', timestamp: [1.5, null] }] };
  assert.deepEqual(toSegments(result, 120, 240), [
    { start: 120, end: 121.5, text: 'Hi' },
    { start: 121.5, end: 240, text: 'there' },
  ]);
  const looped = ['a', 'b', 'b', 'b', 'b', 'c'].map((text) => ({ text }));
  assert.deepEqual(dropRepeats(looped).map((s) => s.text), ['a', 'b', 'b', 'c']);
});
