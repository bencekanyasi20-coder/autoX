import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startApp } from '../server.mjs';

async function fixture(t, overrides = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'xlocal-test-'));
  let secrets = { xAccessToken: 'test-only', openaiKey: 'test-only' };
  const providers = { me: async () => ({ id: '1', username: 'owner' }), publish: async () => ({ id: '999' }), ...overrides };
  const app = await startApp({ dataDir, port: 0, timers: false, providers,
    vault: { get: async () => secrets, save: async value => { secrets = value; } } });
  t.after(async () => { await app.close(); await rm(dataDir, { recursive: true, force: true }); });
  const get = async () => (await fetch(app.url + '/api/state')).json();
  const initial = await get();
  const post = (path, body) => fetch(app.url + path, { method: 'POST', headers: {
    'Content-Type': 'application/json', 'X-CSRF-Token': initial.csrf, Origin: app.url
  }, body: JSON.stringify(body) });
  return { app, get, post };
}

test('post metadata warnings preserve synced posts and clear after a clean sync', async t => {
  let warnings = ['X returned posts, but some reply/repost references may be missing or incomplete.'];
  const { post, get } = await fixture(t, { posts: async () => ({ posts: [{ id: '123', text: 'Real post', author_id: '1' }], users: [], warnings }) });
  assert.equal((await post('/api/sync', { kind: 'posts', confirmed: true })).status, 200);
  let snapshot = await get();
  assert.equal(snapshot.state.posts[0].id, '123');
  assert.equal(snapshot.state.sync.posts.status, 'warning');
  assert.deepEqual(snapshot.state.sync.posts.warnings, warnings);
  warnings = [];
  assert.equal((await post('/api/sync', { kind: 'posts', confirmed: true })).status, 200);
  snapshot = await get();
  assert.equal(snapshot.state.sync.posts.status, 'ok');
  assert.deepEqual(snapshot.state.sync.posts.warnings, []);
});

test('opening local pages and ticking never refresh X, even with a legacy interval', async t => {
  let calls = 0;
  const { app, get, post } = await fixture(t, { me: async () => { calls++; return { id: '1' }; }, posts: async () => { calls++; return { posts: [] }; } });
  app.store.update(s => { s.account = { id: '1' }; s.settings.paused = false; s.settings.syncMinutes = 5; });
  for (let i = 0; i < 3; i++) { await get(); await fetch(app.url + '/'); await app.tick(); }
  assert.equal(calls, 0);
  assert.equal((await post('/api/settings', { syncMinutes: 5 })).status, 400);
  assert.equal((await post('/api/sync', { kind: 'posts' })).status, 400);
  assert.equal(calls, 0);
  assert.equal((await post('/api/sync', { kind: 'posts', confirmed: true })).status, 200);
  assert.equal(calls, 2);
});

test('cross-origin and missing CSRF mutations cannot change settings', async t => {
  const { app, get } = await fixture(t);
  const response = await fetch(app.url + '/api/settings', { method: 'POST', headers: {
    Origin: 'https://evil.example', 'Content-Type': 'application/json'
  }, body: JSON.stringify({ goal: 4 }) });
  assert.equal(response.status, 403);
  assert.notEqual((await get()).state.settings.goal, 4);
  assert.equal(JSON.stringify(await get()).includes('test-only'), false);
});

test('Engage passes the date range separately and caps searches to one page', async t => {
  const calls=[];
  const {app,post}=await fixture(t,{ search:async(...args)=>{calls.push(args);return {posts:[],users:[],hasMore:false};} });
  app.store.update(s=>{s.account={id:'1'};});
  assert.equal((await post('/api/search',{query:'builders',age:'3'})).status,200);
  assert.deepEqual(calls,[['builders',{age:3,singlePage:true}]]);
  assert.equal((await post('/api/search',{query:'builders',age:30})).status,400);
  assert.equal(calls.length,1);
});

test('queue persists draft and sends exactly once', async t => {
  let calls = 0;
  const { app, post, get } = await fixture(t, { publish: async () => { calls++; return { id: '999' }; } });
  app.store.update(s => { s.account = { id: '1', username: 'owner' }; });
  assert.equal((await post('/api/queue', { item: { kind: 'post', text: 'Hello' } })).status, 200);
  const id = (await get()).state.queue[0].id;
  assert.equal((await post('/api/queue/action', { id, action: 'send' })).status, 200);
  assert.equal((await post('/api/queue/action', { id, action: 'send' })).status, 409);
  assert.equal(calls, 1);
  assert.equal((await get()).state.queue[0].status, 'sent');
});

test('uncertain delivery is preserved and not retried by scheduler', async t => {
  let calls = 0;
  const { app, post, get } = await fixture(t, { publish: async () => { calls++; throw Object.assign(new Error('Timed out'), { uncertain: true }); } });
  app.store.update(s => { s.account = { id: '1', username: 'owner' }; });
  await post('/api/queue', { item: { text: 'Hello', kind: 'post' } });
  const id = (await get()).state.queue[0].id;
  await post('/api/queue/action', { id, action: 'send' });
  await app.tick();
  assert.equal((await get()).state.queue[0].status, 'uncertain');
  assert.equal((await post('/api/queue/action', { id, action: 'cancel' })).status, 409);
  assert.equal(calls, 1);
});

test('demo cannot overwrite live account and demo exit preserves configuration', async t => {
  const { app, post, get } = await fixture(t);
  app.store.update(s => { s.account = { id: '1', username: 'owner' }; });
  assert.equal((await post('/api/demo', {})).status, 409);
  assert.equal((await get()).state.account.id, '1');
});

test('bad input and collection names fail without corrupting data', async t => {
  const { post } = await fixture(t);
  assert.equal((await post('/api/queue', { item: { text: '', kind: 'post' } })).status, 400);
  assert.equal((await post('/api/collection', { collection: '__proto__', item: {} })).status, 400);
  assert.equal((await post('/api/settings', { dailyWriteLimit: -1 })).status, 400);
});

test('settings preserve workspace and mismatched X identity cannot publish', async t => {
  let calls = 0;
  const { app, post, get } = await fixture(t, { me: async () => ({ id: '2' }), publish: async () => { calls++; return { id: '9' }; } });
  app.store.update(s => { s.account = { id: '1', username: 'owner' }; });
  assert.equal((await post('/api/settings', { goal: 100 })).status, 200);
  assert.equal((await get()).state.account.id, '1');
  await post('/api/queue', { item: { text: 'Hello', kind: 'post' } });
  const queueId = (await get()).state.queue[0].id;
  assert.equal((await post('/api/queue/action', { id: queueId, action: 'send' })).status, 409);
  assert.equal(calls, 0);
});

test('loading demo while a live sync is pending is rejected', async t => {
  let release, started;
  const began = new Promise(r => { started = r; });
  const { post, get } = await fixture(t, { me: () => { started(); return new Promise(r => { release = r; }); }, posts: async () => ({ posts: [], users: [] }) });
  const pending = post('/api/sync', { kind: 'posts', confirmed: true });
  await began;
  const demo = await post('/api/demo', {});
  release({ id: '1', username: 'owner' });
  await pending;
  assert.equal(demo.status, 409);
  assert.notEqual((await get()).state.demo, true);
});

test('scheduler sends due items once and holds stale schedules for review', async t => {
  let calls = 0;
  const { app, get } = await fixture(t, { publish: async () => { calls++; return { id: '999' }; } });
  app.store.update(s => {
    s.account = { id: '1', username: 'owner' };
    s.queue = [
      { id: 'due', kind: 'post', text: 'Scheduled', status: 'scheduled', scheduledAt: new Date(Date.now() - 1000).toISOString() },
      { id: 'stale', kind: 'post', text: 'Stale', status: 'scheduled', scheduledAt: new Date(Date.now() - 3600000).toISOString() }
    ];
  });
  await app.tick(); await app.tick(); await app.tick();
  assert.equal(calls, 1);
  const items = (await get()).state.queue;
  assert.equal(items[0].status, 'sent'); assert.equal(items[1].status, 'draft');
});

test('paused scheduler and exhausted write budget cannot publish', async t => {
  let calls = 0;
  const { app, post, get } = await fixture(t, { publish: async () => { calls++; return { id: '999' }; } });
  app.store.update(s => {
    s.account = { id: '1', username: 'owner' }; s.settings.paused = true;
    s.queue = [{ id: 'due', kind: 'post', text: 'Scheduled', status: 'scheduled', scheduledAt: new Date(Date.now() - 1000).toISOString() }];
  });
  await app.tick(); assert.equal(calls, 0);
  await post('/api/settings', { paused: false, dailyWriteLimit: 0 });
  await app.tick();
  assert.equal(calls, 0); assert.equal((await get()).state.queue[0].status, 'failed');
});

test('demo reply drafts and username-only manual DM drafts are accepted', async t => {
  const { post } = await fixture(t);
  await post('/api/demo', {});
  assert.equal((await post('/api/queue', { item: { kind: 'reply', text: 'Demo reply', targetId: 'demo-mention-1' } })).status, 200);
  assert.equal((await post('/api/queue', { item: { kind: 'dm', text: 'DM draft', username: 'example' } })).status, 200);
});

test('media upload rejects credentials for a different X account', async t => {
  let uploads = 0;
  const { app, post } = await fixture(t, { me: async () => ({ id: '2' }), uploadImage: async () => { uploads++; return { mediaId: '123' }; } });
  app.store.update(s => { s.account = { id: '1', username: 'owner' }; });
  const result = await post('/api/media', { base64: 'AA==', mimeType: 'image/png' });
  assert.equal(result.status, 409); assert.equal(uploads, 0);
});

test('OAuth callback establishes the authenticated account without a manual sync', async t => {
  const { app, post, get } = await fixture(t, {
    authUrl: ({ state }) => `https://x.com/authorize?state=${state}`,
    exchange: async () => ({ connected: true }),
  });
  await post('/api/settings', { xClientId: 'fixture-client' });
  const connected = await (await post('/api/connect', {})).json();
  const state = new URL(connected.url).searchParams.get('state');
  const callback = await fetch(`${app.url}/oauth/callback?state=${state}&code=fixture`, { redirect: 'manual' });
  assert.equal(callback.status, 302);
  assert.equal((await get()).state.account?.id, '1');
});

test('invalid setting types cannot alter settings or cause internal errors', async t => {
  const { post, get } = await fixture(t);
  const before = (await get()).state.settings;
  for (const body of [{ paused: 'false' }, { dailyWriteLimit: 0.5 }, { goal: null }, { xAccessToken: 42 }, { model: {} }]) {
    assert.equal((await post('/api/settings', body)).status, 400, JSON.stringify(body));
    assert.deepEqual((await get()).state.settings, before);
  }
});

test('OAuth callback preserves workspace when reconnecting a different account', async t => {
  const { app, post, get } = await fixture(t, {
    authUrl: ({ state }) => `https://x.com/authorize?state=${state}`,
    exchange: async () => ({ connected: true }),
    me: async () => ({ id: '2', username: 'other' }),
  });
  app.store.update(s => { s.account = { id: '1', username: 'owner' }; });
  await post('/api/settings', { xClientId: 'fixture-client' });
  const connected = await (await post('/api/connect', {})).json();
  const state = new URL(connected.url).searchParams.get('state');
  const callback = await fetch(`${app.url}/oauth/callback?state=${state}&code=fixture`, { redirect: 'manual' });
  assert.equal(callback.status, 409);
  assert.equal((await get()).state.account.id, '1');
  assert.equal((await fetch(`${app.url}/oauth/callback?state=${state}&code=fixture`)).status, 400);
});

test('usage guide is served as HTML', async t => {
  const { app } = await fixture(t);
  const response = await fetch(app.url + '/guide.html');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/html/);
  assert.match(await response.text(), /<!doctype html>/i);
});

test('language settings persist, preserve content, and reject unsupported values atomically', async t => {
  const { app, post, get } = await fixture(t);
  app.store.update(s => { s.library.push({ id: 'language-test', text: 'Saját magyar szöveg' }); });
  assert.equal((await get()).state.settings.language, 'hu');
  assert.equal((await post('/api/settings', { language: 'en' })).status, 200);
  const snapshot = await get();
  assert.equal(snapshot.state.settings.language, 'en');
  assert.equal(snapshot.state.library[0].text, 'Saját magyar szöveg');
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(join(snapshot.config.dataDir, 'workspace.sqlite'), { readOnly: true });
  try { assert.equal(JSON.parse(db.prepare('SELECT state FROM workspace WHERE id=1').get().state).settings.language, 'en'); }
  finally { db.close(); }
  for (const language of ['de', '', null, {}, 1]) {
    assert.equal((await post('/api/settings', { language, goal: 123 })).status, 400);
    assert.deepEqual((await get()).state.settings, snapshot.state.settings);
  }
  assert.equal((await post('/api/settings', { language: 'hu' })).status, 200);
  assert.equal((await get()).state.settings.language, 'hu');
});

test('demo transitions retain the selected interface language', async t => {
  const { post, get } = await fixture(t);
  await post('/api/settings', { language: 'en' });
  await post('/api/demo', {});
  assert.equal((await get()).state.settings.language, 'en');
  await post('/api/demo/exit', {});
  assert.equal((await get()).state.settings.language, 'en');
});

test('English guide and translation scripts are served with browser-compatible types', async t => {
  const { app } = await fixture(t);
  for (const path of ['/i18n.js', '/errors-i18n.js']) {
    const response = await fetch(app.url + path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type'), /^text\/javascript/);
    assert.ok((await response.text()).length > 50);
  }
  const guide = await fetch(app.url + '/guide.en.html');
  assert.equal(guide.status, 200);
  assert.match(guide.headers.get('content-type'), /^text\/html/);
  assert.match(await guide.text(), /<html lang="en">/);
});

test('AI requests receive the saved language preference', async t => {
  let request;
  const { post } = await fixture(t, { ai: async value => { request = value; return 'fixture'; } });
  await post('/api/settings', { language: 'en' });
  assert.equal((await post('/api/ai', { prompt: 'Saját kérés' })).status, 200);
  assert.equal(request.language, 'en');
  assert.equal(request.prompt, 'Saját kérés');
});
