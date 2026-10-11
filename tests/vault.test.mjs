import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createVault } from '../vault.mjs';

test('Windows vault persists encrypted synthetic secrets and reopens them', { skip: process.platform !== 'win32' }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'xlocal-vault-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const vault = createVault(directory);
  const synthetic = { openaiKey: 'not-a-real-key-test-fixture', xClientId: 'árvíztűrő test' };
  await vault.save(synthetic);
  assert.equal((await readFile(join(directory, 'credentials.dpapi'), 'utf8')).includes(synthetic.openaiKey), false);
  assert.deepEqual(await createVault(directory).get(), synthetic);
});

test('vault save captures its input before queued encryption begins', { skip: process.platform !== 'win32' }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'xlocal-vault-snapshot-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const vault = createVault(directory);
  const synthetic = { openaiKey: 'synthetic-original' };
  const saving = vault.save(synthetic);
  synthetic.openaiKey = 'synthetic-mutated';
  await saving;
  assert.deepEqual(await createVault(directory).get(), { openaiKey: 'synthetic-original' });
  assert.deepEqual(await vault.get(), { openaiKey: 'synthetic-original' });
});
