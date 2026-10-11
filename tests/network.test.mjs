import test from 'node:test';
import assert from 'node:assert/strict';
import './local-network-only.mjs';

test('test fetch guard blocks paid provider calls before network access', async () => {
  await assert.rejects(fetch('https://api.x.com/2/users/me'), /External network disabled/);
  await assert.rejects(fetch('https://api.openai.com/v1/responses'), /External network disabled/);
});
