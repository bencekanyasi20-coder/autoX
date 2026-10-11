import { initialState } from './store.mjs';

/** Fixed synthetic content and arithmetic; no random IDs, real profiles, or calls. */
export function createDemoState(now = Date.now()) {
  const state = initialState();
  const today = Math.floor(Number(now) / 86400000) * 86400000;
  if (!Number.isFinite(today)) throw new Error('Invalid demo time');
  const at = (days, hour = 8) => new Date(today - days * 86400000 + hour * 3600000).toISOString();
  state.demo = true;
  state.account = { id: 'demo-self', username: 'helyi_demo', name: 'Demo · Kovács Bence', description: 'Szintetikus bemutatóadatok. Építés, tanulás, automatizálás.', public_metrics: { followers_count: 248, following_count: 126, tweet_count: 168 } };
  state.settings.style = 'Magyarul, tömören és személyesen. Konkrét példák, sallang nélkül.';
  const texts = [
    'Ma 3 órányi ismétlődő munkát váltottam ki egy 40 soros szkripttel. A jó automatizálás egy unalmas listával kezdődik.',
    'Az első felhasználó nem újabb funkciót kért. Azt kérte, hogy értse, mi történik a gomb megnyomása után.',
    'Egy apró mérés: a konkrét példával kezdődő posztjaimat többen mentik el. Jövő héten ezt tesztelem tovább.',
    'Ha egy termék magyarázatához öt perc kell, először a magyarázatot egyszerűsítem.',
    'Heti építési napló: működő prototípus, két őszinte visszajelzés, egy elengedett ötlet. Ez már haladás.',
    'A saját adataim helyben maradnak. Egy kisebb eszköz is lehet hasznos, ha pontosan egy problémát old meg.',
    'Nálam a rövid feladatlista vált be: mi a következő lépés, mi bizonyítja, hogy kész, és mi nem fér bele?',
  ];
  state.posts = Array.from({ length: 68 }, (_, index) => {
    const days = Math.floor(index * 56 / 68);
    const reply = index % 5 === 2;
    const hour = index % 3 === 0 ? 8 : index % 3 === 1 ? 11 : 16;
    const views = 320 + ((index * 713) % 4100) + (days < 14 ? 480 : 0);
    return { id: `demo-post-${index + 1}`, text: texts[index % texts.length], created_at: at(days, days === 0 ? 0 : hour), author_id: 'demo-self', conversation_id: `demo-conversation-${index + 1}`, referenced_tweets: reply ? [{ type: 'replied_to', id: `demo-parent-${index}` }] : [], public_metrics: { impression_count: views, like_count: 9 + index % 51, reply_count: 2 + index % 12, retweet_count: index % 10, quote_count: index % 4 } };
  });
  state.users = Array.from({ length: 280 }, (_, index) => ({ id: `demo-user-${index + 1}`, username: `pelda_epito_${index + 1}`, name: `${['Anna', 'Dániel', 'Eszter', 'Márk', 'Júlia', 'Péter'][index % 6]} · Demo ${index + 1}`, description: 'Szintetikus profil a helyi bemutatóhoz.', public_metrics: { followers_count: 120 + index * 17, following_count: 80 + index } }));
  state.followers = state.users.slice(0, 248).map(user => user.id);
  state.following = [...state.users.slice(0, 94), ...state.users.slice(248)].map(user => user.id);
  state.relationshipBaseline = true;
  state.sync = { postsAt: at(0, 0), followersAt: at(0, 0), inboxAt: at(0, 0), relationshipBaselineAt: at(90, 0) };
  state.events = Array.from({ length: 30 }, (_, index) => ({ id: `demo-event-${index + 1}`, userId: `demo-user-${index + 1}`, type: index % 7 === 6 ? 'unfollow' : 'follow', observedAt: at(index % 26, 0), read: index > 7 }));
  state.inbox = [
    ['Milyen eszközzel kezdjek, ha most automatizálnék először?', 'waiting', ''],
    ['A helyi tárolás érdekel. Erről tudsz mesélni egy konkrét példán?', 'draft', 'Nálam egy egyszerű SQLite-adatbázis tárolja a helyi munkát. A legjobb kezdés egy jól körülhatárolt feladat.'],
    ['Kipróbáltam a rövid feladatlistát, sokkal átláthatóbb lett a hetem!', 'replied', 'Örülök! Nálam is az egyértelmű készfeltétel segít a legtöbbet.'],
    ['Köszönöm a példát, elmentettem későbbre.', 'ignored', ''],
  ].map(([text, status, draft], index) => ({ id: `demo-inbox-${index + 1}`, post: { id: `demo-mention-${index + 1}`, text, author_id: state.users[index].id, created_at: at(index, 0), conversation_id: 'demo-post-1', referenced_tweets: [{ type: 'replied_to', id: 'demo-post-1' }] }, author: state.users[index], status, draft }));
  state.queue = [{ id: 'demo-queue-1', kind: 'post', text: 'Ezen a héten egyetlen dolgot egyszerűsítek: az első lépést a termékemben. Mi az, amit te kihagynál a saját folyamatodból?', status: 'draft', scheduledAt: null, createdAt: at(0, 0), targetId: '', username: '', error: '' }];
  state.library = [{ id: 'demo-library-1', title: 'Építési napló mintája', text: 'Mi készült el? Mit tanultam? Mit próbálok másképp a következő héten?', createdAt: at(3), tags: 'buildinpublic, napló' }];
  state.feeds = [{ id: 'demo-feed-1', name: 'Magyar építők', query: 'automatizálás lang:hu -is:retweet', createdAt: at(7) }];
  state.products = [{ id: 'demo-product-1', name: 'Helyi munkafolyamat workshop', description: '60 perces konzultáció egy ismétlődő munkafolyamat egyszerűsítéséről. Demo ajánlat.', url: '', createdAt: at(10) }];
  state.leads = [{ id: 'demo-lead-1', userId: 'demo-user-1', username: state.users[0].username, name: state.users[0].name, status: 'new', note: 'Az automatizálásról kérdezett. Szintetikus bemutatópélda.', createdAt: at(1) }];
  state.sessions = [{ id: 'demo-session-1', title: 'Heti posztötletek', prompt: 'Három rövid poszt a heti tanulságokról.', text: '1. Egy konkrét hiba és a javítása.\n2. A felhasználói kérdés, amely megváltoztatta a tervet.\n3. A következő kis kísérlet.', createdAt: at(2) }];
  return state;
}
