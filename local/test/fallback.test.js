import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseFallback, HELPER_CAN_HELP } from '../../src/lib/fallback.js';

test('a blocked lookup goes straight to a running helper', async () => {
  assert.equal(await chooseFallback('blocked', async () => true), 'helper-now');
});

test('a blocked lookup shows the helper panel when no helper is running', async () => {
  assert.equal(await chooseFallback('blocked', async () => false), 'helper-panel');
});

test('every problem the helper can help with is routed to it', async () => {
  for (const code of Object.keys(HELPER_CAN_HELP)) {
    assert.equal(await chooseFallback(code, async () => true), 'helper-now', code);
  }
});

test('other errors do not ask about the helper at all', async () => {
  let asked = false;
  assert.equal(await chooseFallback('bad_link', async () => (asked = true)), 'error');
  assert.equal(asked, false);
});
