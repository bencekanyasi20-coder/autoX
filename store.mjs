import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function initialState() {
  return {
    account: null, posts: [], users: [], followers: [], following: [], events: [],
    inbox: [], queue: [], feeds: [], library: [], leads: [], products: [], sessions: [],
    settings: { language: 'hu', goal: 100000, style: '', model: 'gpt-4.1-mini', syncMinutes: 0, dailyWriteLimit: 20 },
    sync: {}, relationshipBaseline: false, missingFollowers: {},
  };
}

// Credentials belong in the server's protected secret store, never exported state.
function assertNoSecrets(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (/^(?:xClientSecret|xAccessToken|xRefreshToken|openaiKey|apiKey|api_key|client_secret|access_token|refresh_token|authorization|password)$/i.test(key)) {
      throw new Error('Secrets cannot be saved in workspace state');
    }
    assertNoSecrets(child);
  }
}

export function createStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id = 1), state TEXT NOT NULL)');
    db.prepare('INSERT OR IGNORE INTO workspace (id, state) VALUES (1, ?)').run(JSON.stringify(initialState()));
  } catch (error) { db.close(); throw error; }
  const read = db.prepare('SELECT state FROM workspace WHERE id = 1');
  const write = db.prepare('UPDATE workspace SET state = ? WHERE id = 1');
  let closed = false;
  let updating = false;
  function get() {
    if (closed) throw new Error('Workspace store is closed');
    return JSON.parse(read.get().state);
  }
  return {
    get,
    update(fn) {
      if (closed) throw new Error('Workspace store is closed');
      if (updating) throw new Error('Nested workspace updates are not supported');
      updating = true;
      let transaction = false;
      try {
        db.exec('BEGIN IMMEDIATE'); transaction = true;
        const draft = get();
        const returned = fn(draft);
        if (returned && typeof returned.then === 'function') {
          // The rejected callback cannot commit; consume its eventual rejection.
          void Promise.resolve(returned).catch(() => undefined);
          throw new Error('Workspace updates must be synchronous');
        }
        const next = returned === undefined ? draft : returned;
        if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('Workspace state must be an object');
        // Serialize first so cyclic or unsupported values fail before walking keys.
        const json = JSON.stringify(next);
        const persisted = JSON.parse(json);
        if (!persisted || typeof persisted !== 'object' || Array.isArray(persisted)) throw new Error('Workspace state must be an object');
        assertNoSecrets(persisted);
        write.run(json);
        db.exec('COMMIT'); transaction = false;
        return persisted;
      } catch (error) {
        if (transaction) db.exec('ROLLBACK');
        throw error;
      } finally { updating = false; }
    },
    close() { if (!closed) { db.close(); closed = true; } },
  };
}
