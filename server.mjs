import { createServer } from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { createStore, initialState } from './store.mjs';
import { computeAnalytics, applyRelationships } from './analytics.mjs';
import { createDemoState } from './demo.mjs';
import { createProviders } from './providers.mjs';
import { createVault } from './vault.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const iso = () => new Date().toISOString();
const text = (value, max = 10000) => typeof value === 'string' ? value.slice(0, max) : '';
const id = value => /^\d{1,30}$/.test(String(value || '')) ? String(value) : fail('Érvénytelen X-azonosító.');
const merge = (old, values) => [...new Map([...old, ...values].map(item => [item.id, item])).values()];
const equal = (a, b) => typeof a === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function startApp(options = {}) {
  const dataDir = options.dataDir || process.env.XAUTO_DATA_DIR || join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'Xauto');
  const store = options.store || createStore(join(dataDir, 'workspace.sqlite'));
  const vault = options.vault || createVault(dataDir);
  const providers = options.providers || createProviders({ getSecrets: vault.get, saveSecrets: vault.save });
  const csrf = randomBytes(32).toString('hex');
  let baseUrl, timer, syncing = false, sending = false, following = false, uploading = false, reading = 0, authenticating = false, backgroundError = null;
  const oauth = new Map();
  store.update(s => {
    s.settings.syncMinutes = 0; // Legacy intervals cannot re-enable paid background reads.
    for (const item of s.queue) if (item.status === 'sending') {
      item.status = 'uncertain'; item.error = 'A program küldés közben állt le. Ellenőrizd X-en, mielőtt újra küldenél.';
    }
  });

  function live() {
    const state = store.get();
    if (state.demo) fail('Ez bemutató adat. Lépj ki a demóból és csatlakoztasd az X-fiókodat.', 409);
    if (!state.account) fail('Előbb csatlakoztasd és szinkronizáld az X-fiókodat.', 409);
    return state;
  }
  function idleAccount() {
    if (syncing || sending || following || uploading || reading || authenticating) fail('Várd meg a folyamatban lévő X-művelet végét.', 409);
  }
  async function verifyIdentity(accountId) {
    const current = await providers.me();
    if (current.id !== accountId) fail('Az X-kulcs másik fiókhoz tartozik. Csatlakoztasd az eredeti fiókot, vagy használj külön adatmappát.', 409);
  }
  function reserveWrite() {
    store.update(s => {
      if (s.settings.paused) fail('A küldés szünetel. A Beállításokban indíthatod újra.', 409);
      const day = iso().slice(0, 10);
      if (s.writeUsage?.day !== day) s.writeUsage = { day, count: 0 };
      if (s.writeUsage.count >= (s.settings.dailyWriteLimit ?? 20)) fail('Elérted a helyi napi küldési korlátot.', 429);
      s.writeUsage.count++;
    });
  }
  async function sendQueue(queueId) {
    if (sending || authenticating) fail('Egy küldés vagy belépés már folyamatban van.', 409);
    const state = live();
    const item = state.queue.find(q => q.id === queueId);
    if (!item) fail('Nem található a tervezet.', 404);
    if (!['draft', 'scheduled', 'failed'].includes(item.status)) fail('Ez az elem már elküldött vagy bizonytalan állapotú.', 409);
    if (item.kind === 'dm') fail('A privát üzenetet az X-en nyisd meg és küldd el.');
    sending = true;
    try {
      await verifyIdentity(state.account.id);
      reserveWrite();
      store.update(s => { Object.assign(s.queue.find(q => q.id === queueId), { status: 'sending', error: null }); });
      try {
        const result = await providers.publish({ text: item.text, targetId: item.kind === 'reply' ? item.targetId : undefined, mediaIds: item.mediaIds });
        if (!result?.id) throw Object.assign(new Error('Az X nem adott vissza posztazonosítót. Ellenőrizd X-en.'), { uncertain: true });
        store.update(s => {
          Object.assign(s.queue.find(q => q.id === queueId), { status: 'sent', sentAt: iso(), postId: result.id });
          const incoming = s.inbox.find(i => i.id === item.targetId || i.post?.id === item.targetId);
          if (incoming) incoming.status = 'replied';
          s.posts = merge(s.posts, [{ id: result.id, text: item.text, author_id: s.account.id, created_at: iso(),
            referenced_tweets: item.kind === 'reply' ? [{ type: 'replied_to', id: item.targetId }] : [], public_metrics: {} }]);
        });
        return result;
      } catch (error) {
        store.update(s => { Object.assign(s.queue.find(q => q.id === queueId), {
          status: error.uncertain || !error.status ? 'uncertain' : 'failed', error: safeError(error)
        }); });
        throw error;
      }
    } catch (error) {
      store.update(s => {
        const current = s.queue.find(q => q.id === queueId);
        if (current && ['draft','scheduled'].includes(current.status)) Object.assign(current, { status: 'failed', error: safeError(error) });
      });
      throw error;
    } finally { sending = false; }
  }
  async function sync(kind = 'all') {
    if (syncing || authenticating) fail('Már folyamatban van egy frissítés vagy belépés.', 409);
    if (store.get().demo) fail('A bemutató adatokat nem szinkronizáljuk az X-szel.', 409);
    if (!['all', 'posts', 'followers', 'inbox'].includes(kind)) fail('Ismeretlen frissítési típus.');
    syncing = true;
    try {
      const account = await providers.me();
      const previous = store.get().account;
      if (previous && previous.id !== account.id) fail('Másik X-fiókhoz külön adatmappa szükséges. A meglévő adatokat nem írjuk felül.', 409);
      store.update(s => { s.account = account; });
      for (const part of (kind === 'all' ? ['posts', 'followers', 'inbox'] : [kind])) {
        try {
          let warnings = [];
          if (part === 'posts') {
            const result = await providers.posts(account.id);
            warnings = result.warnings || [];
            store.update(s => { s.posts = merge(s.posts, result.posts); s.users = merge(s.users, result.users || []); });
          } else if (part === 'followers') {
            const result = await providers.relationships(account.id);
            store.update(s => applyRelationships(s, result, iso()));
          } else {
            const result = await providers.inbox(account.id, account.username);
            warnings = result.warnings || [];
            store.update(s => {
              s.users = merge(s.users, result.users || []);
              const existing = new Map(s.inbox.map(i => [i.id, i]));
              for (const post of result.posts) {
                if (post.author_id === account.id) continue;
                const old = existing.get(post.id);
                existing.set(post.id, { ...old, id: post.id, post, author: s.users.find(u => u.id === post.author_id), status: old?.status || 'waiting', draft: old?.draft || '' });
              }
              s.inbox = [...existing.values()].sort((a, b) => String(b.post.created_at).localeCompare(a.post.created_at));
            });
          }
          store.update(s => { s.sync[part] = { at: iso(), status: warnings.length ? 'warning' : 'ok', warnings }; });
        } catch (error) {
          store.update(s => { s.sync[part] = { at: iso(), status: 'error', error: safeError(error) }; });
          throw error;
        }
      }
      backgroundError = null;
      return { ok: true };
    } finally { syncing = false; }
  }
  async function tick() {
    const state = store.get();
    if (state.demo || state.settings.paused || !state.account) return;
    const due = state.queue.find(q => q.status === 'scheduled' && Date.parse(q.scheduledAt) <= Date.now());
    if (due && !sending) {
      if (Date.now() - Date.parse(due.scheduledAt) > 15 * 60000) {
        store.update(s => { Object.assign(s.queue.find(q => q.id === due.id), { status: 'draft', error: 'Az időpont több mint 15 perce elmúlt. Ellenőrizd, majd küldd el kézzel.' }); });
      } else {
        try { await sendQueue(due.id); } catch (error) { backgroundError = safeError(error); }
      }
    }
  }
  function safeError(error) {
    // Provider adapters use curated errors; never surface response headers or tokens.
    return text(error.message || 'A művelet sikertelen.', 500).replace(/Bearer\s+\S+|sk-[\w-]{8,}/gi, '[rejtve]');
  }
  async function readBody(req) {
    if (!String(req.headers['content-type']).startsWith('application/json')) fail('JSON kérés szükséges.', 415);
    let length = 0; const chunks = [];
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 8 * 1024 * 1024) fail('Túl nagy kérés.', 413);
      chunks.push(chunk);
    }
    try {
      const result = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      if (!result || Array.isArray(result) || typeof result !== 'object') fail('JSON objektum szükséges.');
      return result;
    } catch { fail('Érvénytelen JSON kérés.'); }
  }
  async function getConfig() {
    const secrets = await vault.get();
    const settings = store.get().settings;
    return { xConnected: !!secrets.xAccessToken, openaiConfigured: !!secrets.openaiKey,
      hasXToken: !!secrets.xAccessToken, hasOpenAIKey: !!secrets.openaiKey,
      xClientId: secrets.xClientId || '', model: settings.model, redirectUri: baseUrl + '/oauth/callback', dataDir, paused: !!settings.paused };
  }
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const json = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    try {
      if (req.headers.host !== new URL(baseUrl).host) fail('Érvénytelen helyi cím.', 403);
      if (req.headers.origin && req.headers.origin !== baseUrl) fail('Más oldalról érkező kérés tiltva.', 403);
      const url = new URL(req.url, baseUrl);
      const path = url.pathname;
      if (req.method === 'GET') {
        if (path === '/health') return json({ app: 'xauto', version: '0.1.0' });
        if (path === '/api/state') return json({ state: store.get(), analytics: computeAnalytics(store.get(), [7,14,28].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 28), config: await getConfig(), csrf, runtime: { syncing, sending, backgroundError } });
        if (path === '/api/export') {
          const state = store.get();
          res.setHeader('Content-Disposition', `attachment; filename="xauto-${iso().slice(0,10)}.${url.searchParams.get('format') === 'csv' ? 'csv' : 'json'}"`);
          if (url.searchParams.get('format') !== 'csv') return json(state);
          const cell = value => '"' + String(value ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
          const rows = [['id','text','created_at','impressions','likes','replies'], ...state.posts.map(p => [p.id,p.text,p.created_at,p.public_metrics?.impression_count,p.public_metrics?.like_count,p.public_metrics?.reply_count])];
          res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8' }); return res.end('\ufeff' + rows.map(r => r.map(cell).join(',')).join('\r\n'));
        }
        if (path === '/oauth/callback') {
          idleAccount();
          const entry = oauth.get(url.searchParams.get('state'));
          oauth.delete(url.searchParams.get('state'));
          if (!entry || entry.expires < Date.now()) fail('Lejárt vagy érvénytelen X-belépés. Indítsd újra.');
          if (!url.searchParams.get('code')) fail('Az X-belépés nem fejeződött be.');
          authenticating = true;
          try {
            await providers.exchange({ code: url.searchParams.get('code'), verifier: entry.verifier, redirectUri: baseUrl + '/oauth/callback' });
            const account = await providers.me();
            const previous = store.get().account;
            if (previous && previous.id !== account.id) fail('Másik X-fiókhoz külön adatmappa szükséges. A meglévő adatokat nem írjuk felül.', 409);
            store.update(s => { s.account = account; });
          }
          finally { authenticating = false; }
          res.writeHead(302, { Location: '/#settings' }); return res.end();
        }
        const assets = { '/': ['index.html','text/html'], '/index.html': ['index.html','text/html'], '/guide.html': ['guide.html','text/html'], '/guide.en.html': ['guide.en.html','text/html'], '/i18n.js': ['i18n.js','text/javascript'], '/errors-i18n.js': ['errors-i18n.js','text/javascript'], '/app.js': ['app.js','text/javascript'], '/style.css': ['style.css','text/css'] };
        if (assets[path]) {
          const [name, type] = assets[path];
          res.writeHead(200, { 'Content-Type': type + '; charset=utf-8' }); return res.end(await readFile(join(root, 'public', name)));
        }
        fail('Nem található.', 404);
      }
      if (req.method !== 'POST') fail('Nem támogatott művelet.', 405);
      if (!equal(req.headers['x-csrf-token'], csrf)) fail('Frissítsd az oldalt a művelethez.', 403);
      const body = await readBody(req);
      if (path === '/api/settings') {
        const next = {};
        if (body.language !== undefined) {
          if (!['hu', 'en'].includes(body.language)) fail('Érvénytelen beállítás: language');
          next.language = body.language;
        }
        for (const key of ['goal','syncMinutes','dailyWriteLimit']) if (body[key] !== undefined) {
          if (!['number','string'].includes(typeof body[key]) || body[key] === '') fail('Érvénytelen beállítás: ' + key);
          const n = Number(body[key]);
          const max = key === 'goal' ? 1e10 : key === 'syncMinutes' ? 1440 : 1000;
          if (!Number.isInteger(n) || n < 0 || n > max || (key === 'syncMinutes' && n !== 0)) fail('Érvénytelen beállítás: ' + key);
          next[key] = n;
        }
        for (const key of ['style','model','niche']) if (body[key] !== undefined) {
          if (typeof body[key] !== 'string') fail('Érvénytelen beállítás: ' + key);
          next[key] = text(body[key], key === 'model' ? 100 : 4000);
        }
        if (body.paused !== undefined) {
          if (typeof body.paused !== 'boolean') fail('Érvénytelen beállítás: paused');
          next.paused = body.paused;
        }
        const secretKeys = ['xClientId','xClientSecret','xAccessToken','openaiKey'];
        for (const key of secretKeys) if (body[key] !== undefined && typeof body[key] !== 'string') fail('Érvénytelen beállítás: ' + key);
        if (secretKeys.some(k => body[k]?.trim())) {
          idleAccount(); authenticating = true;
          try {
            const secrets = await vault.get();
            for (const k of secretKeys) if (typeof body[k] === 'string' && body[k].trim()) secrets[k] = body[k].trim();
            if (body.xAccessToken?.trim()) { delete secrets.xRefreshToken; delete secrets.xExpiresAt; }
            await vault.save(secrets);
          } finally { authenticating = false; }
        }
        store.update(s => { Object.assign(s.settings, next); }); return json({ ok: true });
      }
      if (path === '/api/connect') {
        if (store.get().demo) fail('Előbb lépj ki a demóból.', 409);
        const secrets = await vault.get();
        if (!secrets.xClientId) fail('Add meg az X OAuth Client ID-t a Beállításokban.');
        const state = randomBytes(24).toString('hex'), verifier = randomBytes(48).toString('base64url');
        oauth.clear(); oauth.set(state, { verifier, expires: Date.now() + 10 * 60000 });
        return json({ url: providers.authUrl({ clientId: secrets.xClientId, redirectUri: baseUrl + '/oauth/callback', state, verifier }) });
      }
      if (path === '/api/demo') {
        idleAccount();
        if (store.get().account && !store.get().demo) fail('Élő fiók helyére nem tölthető demó.', 409);
        store.update(s => {
          const language = s.settings.language === 'en' ? 'en' : 'hu';
          Object.assign(s, createDemoState());
          s.settings.language = language;
        }); return json({ ok: true });
      }
      if (path === '/api/demo/exit') {
        idleAccount();
        if (!store.get().demo) fail('Nincs aktív demó.', 409);
        store.update(s => { const settings = s.settings; Object.keys(s).forEach(k => delete s[k]); Object.assign(s, initialState(), { settings }); });
        return json({ ok: true });
      }
      if (path === '/api/sync') {
        if (body.confirmed !== true) fail('Az X-szinkron külön jóváhagyást igényel, mert API-költséget okozhat.');
        return json(await sync(body.kind || 'all'));
      }
      if (path === '/api/search') {
        live(); const query = text(body.query, 512).trim(); if (!query) fail('Adj meg keresést.');
        const age = body.age === undefined || body.age === '' ? undefined : Number(body.age);
        if (age !== undefined && (!['number','string'].includes(typeof body.age) || ![1,3,7].includes(age))) fail('Invalid search date range.');
        if (authenticating) fail('Várd meg a belépés végét.', 409);
        reading++;
        try { return json(await providers.search(query, { age, singlePage: true })); } finally { reading--; }
      }
      if (path === '/api/analyze') {
        live(); const username = text(body.username, 30).replace(/^@/, '');
        if (!/^[A-Za-z0-9_]{1,15}$/.test(username)) fail('Érvénytelen X felhasználónév.');
        if (authenticating) fail('Várd meg a belépés végét.', 409);
        reading++;
        try { return json({ ...await providers.account(username), analysis: null }); } finally { reading--; }
      }
      if (path === '/api/ai') {
        const state = store.get();
        if (!(await vault.get()).openaiKey) fail('Add meg az OpenAI-kulcsot a Beállításokban.', 409);
        const prompt = text(body.prompt, 12000).trim(); if (!prompt) fail('Adj meg egy kérést.');
        const recentPosts = [...state.posts].sort((a,b) => String(b.created_at).localeCompare(a.created_at)).slice(0,15);
        const context = JSON.stringify({ request: body.context, products: state.products, ownPosts: recentPosts, inspirations: state.library.slice(-10) }).slice(0, 40000);
        return json({ text: await providers.ai({ prompt, context, mode: text(body.mode, 50), model: state.settings.model, style: state.settings.style, language: state.settings.language === 'en' ? 'en' : 'hu' }) });
      }
      if (path === '/api/follow') {
        if (following || authenticating) fail('Egy követési művelet vagy belépés folyamatban van.', 409);
        const state = live(); const userId = id(body.userId);
        if (typeof body.follow !== 'boolean') fail('A követési művelet hiányzik.');
        following = true;
        try {
          await verifyIdentity(state.account.id);
          reserveWrite(); const result = await providers.follow(state.account.id, userId, body.follow);
          store.update(s => { s.following = s.following.filter(x => x !== userId); if (body.follow && result?.following !== false && !result?.pending_follow) s.following.push(userId); });
          return json({ ok: true, result });
        } finally { following = false; }
      }
      if (path === '/api/inbox') {
        store.update(s => {
          const item = s.inbox.find(i => i.id === body.id); if (!item) fail('Nem található a válasz.', 404);
          if (body.status !== undefined) {
            if (!['waiting','draft','replied','ignored'].includes(body.status)) fail('Érvénytelen állapot.');
            item.status = body.status;
          }
          if (body.draft !== undefined) item.draft = text(body.draft);
        }); return json({ ok: true });
      }
      if (path === '/api/queue') {
        if (sending) fail('Várd meg a folyamatban lévő küldést a sor szerkesztése előtt.', 409);
        const item = body.item || {}; const content = text(item.text).trim();
        if (!content || content.length > 10000) fail('Írj szöveget a tervezethez.');
        const kind = item.kind || 'post'; if (!['post','reply','dm'].includes(kind)) fail('Érvénytelen tervezettípus.');
        if (kind === 'reply' && !(store.get().demo && /^demo-[\w-]+$/.test(item.targetId || ''))) id(item.targetId);
        if (kind === 'dm' && !/^\d{1,30}$/.test(item.targetId || '') && !/^[A-Za-z0-9_]{1,15}$/.test(item.username || '')) fail('Adj meg X felhasználónevet vagy azonosítót a DM-hez.');
        let scheduledAt = null;
        if (item.scheduledAt) {
          if (kind === 'dm') fail('A DM küldése kézi művelet.');
          if (!Number.isFinite(Date.parse(item.scheduledAt)) || Date.parse(item.scheduledAt) <= Date.now()) fail('Jövőbeli időpontot adj meg.');
          if (store.get().demo) fail('Bemutató adatokkal nem időzíthető élő küldés.', 409);
          scheduledAt = new Date(item.scheduledAt).toISOString();
        }
        const queueId = item.id || randomUUID();
        store.update(s => {
          const old = s.queue.find(q => q.id === queueId);
          if (old && !['draft','scheduled','failed'].includes(old.status)) fail('Ezt az elemet már nem lehet módosítani.', 409);
          const value = { id: queueId, kind, text: content, targetId: item.targetId || '', username: text(item.username, 30),
            mediaIds: Array.isArray(item.mediaIds) ? item.mediaIds.slice(0,4).map(id) : [],
            status: scheduledAt ? 'scheduled' : 'draft', scheduledAt, createdAt: old?.createdAt || iso() };
          s.queue = merge(s.queue, [value]);
        }); return json({ ok: true, id: queueId });
      }
      if (path === '/api/queue/action') {
        if (sending) fail('Várd meg a folyamatban lévő küldés végét.', 409);
        if (body.action === 'send') return json(await sendQueue(body.id));
        store.update(s => {
          const item = s.queue.find(q => q.id === body.id); if (!item) fail('Nem található az elem.', 404);
          if (item.status === 'sending') fail('Folyamatban lévő küldés nem módosítható.', 409);
          if (body.action === 'delete') s.queue = s.queue.filter(q => q.id !== body.id);
          else if (body.action === 'cancel') {
            if (!['draft','scheduled','failed'].includes(item.status)) fail('Elküldött vagy bizonytalan elemet nem lehet új küldésre visszaállítani. Előbb ellenőrizd az X-et.', 409);
            item.status = 'draft'; item.scheduledAt = null;
          }
          else if (body.action === 'sent') { item.status = 'sent'; item.sentAt = iso(); const incoming = s.inbox.find(i => i.id === item.targetId); if (incoming) incoming.status = 'replied'; }
          else fail('Ismeretlen művelet.');
        }); return json({ ok: true });
      }
      if (path === '/api/collection') {
        if (!['feeds','library','leads','products','sessions'].includes(body.collection)) fail('Érvénytelen gyűjtemény.');
        store.update(s => {
          if (body.deleteId) s[body.collection] = s[body.collection].filter(i => i.id !== body.deleteId);
          else {
            if (!body.item || typeof body.item !== 'object' || Array.isArray(body.item)) fail('Érvénytelen elem.');
            if (JSON.stringify(body.item).length > 50000) fail('Túl nagy elem.');
            s[body.collection] = merge(s[body.collection], [{ ...body.item, id: text(body.item.id, 100) || randomUUID(), createdAt: body.item.createdAt || iso() }]);
          }
        }); return json({ ok: true });
      }
      if (path === '/api/events/read') { store.update(s => s.events.forEach(e => { e.read = true; })); return json({ ok: true }); }
      if (path === '/api/stop') { store.update(s => { s.settings.paused = true; }); return json({ ok: true }); }
      if (path === '/api/media') {
        const state = live(); if (!providers.uploadImage) fail('A képfeltöltés nem érhető el.', 501);
        if (uploading || authenticating) fail('Várd meg a folyamatban lévő feltöltést vagy belépést.', 409);
        if (!['image/png','image/jpeg','image/webp'].includes(body.mimeType) || typeof body.base64 !== 'string') fail('PNG/JPEG/WebP kép szükséges.');
        uploading = true;
        try {
          await verifyIdentity(state.account.id); reserveWrite();
          return json(await providers.uploadImage({ base64: body.base64, mimeType: body.mimeType }));
        } finally { uploading = false; }
      }
      fail('Nem található.', 404);
    } catch (error) {
      if (!res.headersSent) json({ error: safeError(error) }, Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 500);
      else res.end();
    }
  });
  server.requestTimeout = 30000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(options.port ?? Number(process.env.PORT || 4317), '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  if (options.timers !== false) timer = setInterval(() => { tick().catch(e => { backgroundError = safeError(e); }); }, 10000);
  return { server, url: baseUrl, store, tick, async close() { clearInterval(timer); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startApp().then(app => {
    console.log(`Xauto: ${app.url}`);
    for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => { app.close().then(() => process.exit(0)); });
  }).catch(error => { console.error(error.code === 'EADDRINUSE' ? 'A 4317 port foglalt. Nyisd meg a már futó alkalmazást, vagy állíts másik PORT értéket.' : 'Indítási hiba: ' + error.message); process.exitCode = 1; });
}
