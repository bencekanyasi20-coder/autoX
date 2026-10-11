import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initialState, createStore } from '../store.mjs';
import { computeAnalytics, applyRelationships } from '../analytics.mjs';
import { createDemoState } from '../demo.mjs';

const now = Date.parse('2026-10-11T12:00:00Z');
const metrics = (impressions, likes = 5) => ({ impression_count: impressions, like_count: likes, reply_count: 2, retweet_count: 2, quote_count: 1 });
const post = (id, created_at, public_metrics, reply = false) => ({ id, author_id: 'me', text: id, created_at, public_metrics, referenced_tweets: reply ? [{ type: 'replied_to', id: 'parent' }] : [] });

test('SQLite persists isolated updates and rolls back thrown, async, and secret writes', () => {
  const root = mkdtempSync(join(tmpdir(), 'xauto-data-'));
  let store;
  try {
    const path = join(root, 'nested', 'workspace.sqlite');
    store = createStore(path);
    store.update(s => { s.settings.style = 'rövid'; });
    const outside = store.get(); outside.settings.style = 'outside';
    assert.equal(store.get().settings.style, 'rövid');
    assert.throws(() => store.update(s => { s.settings.style = 'bad'; throw new Error('abort'); }), /abort/);
    assert.throws(() => store.update(async s => { s.settings.style = 'async'; }), /synchronous/i);
    assert.throws(() => store.update(s => { s.settings.openaiKey = 'secret'; }), /secret/i);
    assert.equal(store.get().settings.style, 'rövid');
    store.close(); store = createStore(path);
    assert.equal(store.get().settings.style, 'rövid');
    store.update(() => ({ ...initialState(), demo: true }));
    assert.equal(store.get().demo, true);
  } finally { store?.close(); rmSync(root, { recursive: true, force: true }); }
});

test('incomplete relationship snapshots make no mutations, including user enrichment', () => {
  const state = initialState();
  const before = structuredClone(state);
  applyRelationships(state, { followers: ['a'], following: [], users: [{ id: 'a', name: 'A' }], complete: false }, new Date(now).toISOString());
  assert.deepEqual(state, before);
});

test('baseline emits no events; removals need two complete misses and returning users reset misses', () => {
  const state = initialState();
  applyRelationships(state, { followers: ['a', 'b'], following: ['b', 'c'], users: [{ id: 'a', name: 'A' }], complete: true }, '2026-10-01T12:00:00Z');
  assert.equal(state.relationshipBaseline, true);
  assert.deepEqual(state.events, []);
  applyRelationships(state, { followers: ['b', 'd'], following: ['b'], users: [{ id: 'a', username: 'alma' }], complete: true }, '2026-10-02T12:00:00Z');
  assert.deepEqual(state.followers, ['a', 'b', 'd']);
  assert.deepEqual(state.events.map(e => [e.type, e.userId]), [['follow', 'd']]);
  applyRelationships(state, { followers: ['a', 'b', 'd'], following: ['b'], users: [], complete: true }, '2026-10-03T12:00:00Z');
  applyRelationships(state, { followers: ['b', 'd'], following: ['b'], users: [], complete: true }, '2026-10-04T12:00:00Z');
  applyRelationships(state, { followers: [], following: [], users: [], complete: false }, '2026-10-05T12:00:00Z');
  assert.ok(state.followers.includes('a'));
  applyRelationships(state, { followers: ['b', 'd'], following: ['b'], users: [], complete: true }, '2026-10-06T12:00:00Z');
  assert.deepEqual(state.followers, ['b', 'd']);
  assert.deepEqual(state.events.map(e => [e.type, e.userId]), [['follow', 'd'], ['unfollow', 'a']]);
  assert.deepEqual(state.users[0], { id: 'a', name: 'A', username: 'alma' });
  assert.equal(new Set(state.events.map(e => e.id)).size, 2);
  const followers = computeAnalytics(state, 7, now).followers;
  assert.deepEqual(followers, { total: 2, following: 1, notFollowingBack: 0, mutual: 1 });
});

test('malformed complete snapshot cannot partly mutate relationships', () => {
  const state = initialState(); const before = structuredClone(state);
  assert.throws(() => applyRelationships(state, { followers: ['a'], following: null, users: [], complete: true }, new Date(now).toISOString()));
  assert.deepEqual(state, before);
});

test('analytics uses disjoint UTC calendar periods, weighted rates, and ignores future/foreign posts', () => {
  const state = initialState(); state.account = { id: 'me' };
  state.posts = [
    post('old', '2026-10-08T00:00:00Z', metrics(50)),
    post('previous', '2026-10-09T23:59:59Z', metrics(200)),
    post('one', '2026-10-10T08:00:00Z', metrics(100)),
    post('reply', '2026-10-11T09:00:00Z', metrics(300), true),
    post('future', '2026-10-11T23:00:00Z', metrics(999)),
    { ...post('other', '2026-10-11T09:00:00Z', metrics(999)), author_id: 'other' },
  ];
  const a = computeAnalytics(state, 2, now);
  assert.equal(a.totals.posts, 1); assert.equal(a.totals.replies, 1);
  assert.equal(a.totals.impressions, 400); assert.equal(a.totals.engagementRate, 5);
  assert.equal(a.previous.impressions, 250);
  assert.deepEqual(a.daily.map(d => [d.date, d.impressions]), [['2026-10-10', 100], ['2026-10-11', 300]]);
  assert.equal(a.topPosts[0].id, 'reply');
  assert.deepEqual(a.bestHours.map(h => h.hour), [8, 9]);
  assert.equal(a.totals.netFollowers, null);
  assert.throws(() => computeAnalytics(state, 0, now), /days/i);
});

test('missing impressions and interactions remain null with honest coverage', () => {
  const state = initialState(); state.account = { id: 'me' };
  state.posts = [post('known', '2026-10-10T08:00:00Z', metrics(100)), post('unknown', '2026-10-11T09:00:00Z', { like_count: 5 })];
  const a = computeAnalytics(state, 2, now);
  assert.equal(a.totals.impressions, null); assert.equal(a.totals.engagementRate, null);
  assert.equal(a.daily[1].impressions, null);
  assert.equal(a.coverage.impressionsKnown, 1); assert.equal(a.coverage.postsTotal, 2);
  assert.equal(a.topPosts.find(p => p.id === 'unknown').impressions, null);
  assert.equal(computeAnalytics(initialState(), 2, now).totals.impressions, null);
  assert.equal(computeAnalytics(initialState(), 2, now).followers.total, null);
});

test('net follower counts are only known for fully observed periods', () => {
  const state = initialState();
  applyRelationships(state, { followers: [], following: [], users: [], complete: true }, '2026-10-01T00:00:00Z');
  state.events = [{ id: '1', type: 'follow', userId: 'a', observedAt: '2026-10-10T01:00:00Z' }, { id: '2', type: 'unfollow', userId: 'b', observedAt: '2026-10-11T01:00:00Z' }];
  assert.equal(computeAnalytics(state, 2, now).totals.netFollowers, 0);
  assert.equal(computeAnalytics(state, 28, now).totals.netFollowers, null);
});

test('demo is deterministic, labelled synthetic, and has usable analytics and all sample workflows', () => {
  const a = createDemoState(now);
  assert.deepEqual(a, createDemoState(now));
  assert.equal(a.demo, true); assert.match(a.account.username, /demo/i);
  for (const key of ['posts', 'inbox', 'followers', 'events', 'library', 'queue', 'products', 'leads', 'feeds', 'sessions']) assert.ok(a[key].length > 0, key);
  assert.ok(computeAnalytics(a, 28, now).totals.impressions > 1000);
});

test('duplicate and older relationship observations cannot confirm removals or rewrite profiles', () => {
  const state = initialState();
  applyRelationships(state, { followers: ['a'], following: [], complete: true }, '2026-10-01T00:00:00Z');
  const missing = { followers: [], following: [], users: [{ id: 'a', name: 'Current' }], complete: true };
  applyRelationships(state, missing, '2026-10-02T00:00:00Z');
  const before = structuredClone(state);
  applyRelationships(state, missing, '2026-10-02T00:00:00Z');
  assert.deepEqual(state, before);
  applyRelationships(state, { ...missing, users: [{ id: 'a', name: 'Stale' }] }, '2026-10-01T12:00:00Z');
  assert.deepEqual(state, before);
  applyRelationships(state, missing, '2026-10-03T00:00:00Z');
  assert.deepEqual(state.followers, []);
  assert.equal(state.events.length, 1);
});

test('store validates the serialized root before committing replacement state', () => {
  const store = createStore(':memory:');
  try {
    const before = store.get();
    for (const replacement of [[], null, 'bad', 42]) {
      assert.throws(() => store.update(() => ({ toJSON: () => replacement })), /state must be an object/i);
      assert.deepEqual(store.get(), before);
    }
  } finally { store.close(); }
});
