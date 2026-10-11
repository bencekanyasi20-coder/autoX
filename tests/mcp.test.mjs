import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { initialState, createStore } from '../store.mjs';
import { handleMcp } from '../mcp.mjs';

const rpc = (method, params, id = 1) => ({ jsonrpc: '2.0', id, method, params });
const call = (state, name, args = {}) => handleMcp(rpc('tools/call', { name, arguments: args }), state);
const output = result => JSON.parse(result.result.content[0].text);

test('MCP initializes supported protocol versions and advertises only read tools', () => {
  const state = initialState();
  for (const protocolVersion of ['2024-11-05', '2025-03-26']) {
    const reply = handleMcp(rpc('initialize', { protocolVersion }), state);
    assert.equal(reply.result.protocolVersion, protocolVersion);
    assert.equal(reply.result.serverInfo.name, 'xauto');
  }
  const tools = handleMcp(rpc('tools/list'), state).result.tools;
  assert.deepEqual(tools.map(t => t.name), ['read_summary', 'list_posts', 'list_followers', 'list_inbox', 'list_drafts']);
  assert.ok(tools.every(t => t.annotations.readOnlyHint && t.inputSchema.type === 'object'));
  assert.equal(handleMcp({ jsonrpc: '2.0', method: 'notifications/initialized' }, state), null);
});

test('MCP bounds and filters local reads without mutating state or returning settings/secrets', () => {
  const state = initialState();
  state.account = { id: 'me', username: 'demo', name: 'Demo', xAccessToken: 'not-for-client' };
  state.followers = ['a']; state.following = ['a', 'b']; state.relationshipBaseline = true;
  state.users = [{ id: 'a', username: 'alice' }, { id: 'b', username: 'bob', access_token: 'not-for-client' }];
  state.posts = [{ id: 'p1', text: 'One', created_at: '2026-10-10T00:00:00Z', author_id: 'me' }, { id: 'p2', text: 'Two', created_at: '2026-10-11T00:00:00Z', author_id: 'me' }];
  state.inbox = [{ id: 'i1', status: 'waiting', post: state.posts[0], author: state.users[0] }, { id: 'i2', status: 'replied', post: state.posts[1] }];
  state.queue = [{ id: 'q1', text: 'Draft', status: 'draft' }, { id: 'q2', text: 'Sent', status: 'sent' }];
  state.settings.openaiKey = 'not-for-client';
  const before = structuredClone(state);
  assert.deepEqual(output(call(state, 'list_posts', { limit: 1 })).map(p => p.id), ['p2']);
  assert.deepEqual(output(call(state, 'list_followers', { kind: 'notFollowingBack' })), [{ id: 'b', username: 'bob' }]);
  assert.deepEqual(output(call(state, 'list_followers', { kind: 'mutual' })).map(p => p.id), ['a']);
  assert.deepEqual(output(call(state, 'list_inbox', { status: 'waiting' })).map(p => p.id), ['i1']);
  assert.deepEqual(output(call(state, 'list_drafts')).map(p => p.id), ['q1']);
  const summary = output(call(state, 'read_summary', { days: 7 }));
  assert.deepEqual(summary.account, { id: 'me', username: 'demo', name: 'Demo' });
  assert.equal(summary.analytics.coverage.days, 7);
  assert.ok(!JSON.stringify(summary).includes('not-for-client'));
  assert.deepEqual(state, before);
});

test('MCP returns JSON-RPC errors for unknown methods/tools and malformed inputs', () => {
  const state = initialState();
  assert.equal(handleMcp(rpc('write_post'), state).error.code, -32601);
  assert.equal(call(state, 'publish').error.code, -32602);
  for (const args of [{ limit: -1 }, { limit: 201 }, { limit: '5' }, { extra: true }]) assert.equal(call(state, 'list_posts', args).error.code, -32602);
  assert.equal(call(state, 'list_followers', { kind: 'unknown' }).error.code, -32602);
  assert.equal(call(state, 'list_inbox', { status: 'unknown' }).error.code, -32602);
  assert.equal(call(state, 'read_summary', { days: 0 }).error.code, -32602);
  assert.equal(handleMcp({ jsonrpc: '1.0', id: 1, method: 'ping' }, state).error.code, -32600);
  assert.equal(handleMcp(null, state).error.code, -32600);
});

test('MCP CLI reads the shared SQLite workspace and emits JSON lines only', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'xauto-mcp-'));
  const path = join(dataDir, 'workspace.sqlite');
  const store = createStore(path);
  try {
    store.update(s => { s.posts = [{ id: 'p1', text: 'Local only', created_at: '2026-10-11T00:00:00Z' }]; });
    const before = store.get();
    const child = spawnSync(process.execPath, [fileURLToPath(new URL('../mcp.mjs', import.meta.url))], {
      env: { ...process.env, XAUTO_DATA_DIR: dataDir }, encoding: 'utf8', timeout: 5000,
      input: [JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }), '{bad', JSON.stringify(rpc('tools/call', { name: 'list_posts', arguments: {} }, 'test'))].join('\n') + '\n',
    });
    assert.equal(child.status, 0, child.stderr);
    const lines = child.stdout.trim().split('\n').map(line => JSON.parse(line));
    assert.equal(lines.length, 2); assert.equal(lines[0].error.code, -32700);
    assert.equal(lines[1].id, 'test'); assert.equal(output(lines[1])[0].text, 'Local only');
    assert.deepEqual(store.get(), before);
  } finally { store.close(); rmSync(dataDir, { recursive: true, force: true }); }
});

test('MCP list_posts applies own-account filtering before limiting', () => {
  const state = initialState(); state.account = { id: 'me' };
  state.posts = [
    { id: 'own', author_id: 'me', created_at: '2026-10-10T00:00:00Z' },
    { id: 'foreign', author_id: 'other', created_at: '2026-10-11T00:00:00Z' },
  ];
  assert.deepEqual(output(call(state, 'list_posts', { limit: 1 })).map(p => p.id), ['own']);
});
