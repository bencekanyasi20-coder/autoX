'use strict';

const t = source => window.XautoI18n.translate(source);
const html = (parts, ...values) => window.XautoI18n.html(parts, ...values);
const locale = () => window.XautoI18n.locale;
const errorText = message => window.XautoErrors.translate(message, window.XautoI18n.language);
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => value == null || !Number.isFinite(Number(value)) ? '—' : new Intl.NumberFormat(locale(), {maximumFractionDigits:1}).format(Number(value));
const date = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString(locale(), {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : t('Nincs időpont');
const profile = username => `https://x.com/${encodeURIComponent(String(username || '').replace(/^@/, ''))}`;
const postURL = id => `https://x.com/i/web/status/${encodeURIComponent(id || '')}`;
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">${({overview:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',analytics:'<path d="M4 20V10m8 10V4m8 16v-7M2 21h20"/>',followers:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/>',inbox:'<path d="M4 4h16v13H9l-5 4V4Z"/><path d="M8 8h8M8 12h5"/>',engage:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',studio:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',queue:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h3m3 0h2"/>',patterns:'<path d="M4 17 9 12l4 3 7-10M15 5h5v5"/>',leads:'<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M9 5V3h6v2M8 11h8m-8 5h5"/>',settings:'<path d="M10 3h4l1 3 3 1 3 3v4l-3 1-1 3-3 3h-4l-1-3-3-1-3-3v-4l3-1 1-3 3-3Z"/><circle cx="12" cy="12" r="3"/>',exports:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'})[name] || ''}</svg>`;
const pages = [['overview','Áttekintés'],['analytics','Analitika'],['followers','Követők'],['inbox','Válaszok'],['engage','Engage'],['studio','Studio'],['queue','Küldési sor'],['patterns','Minták'],['leads','Leadlista'],['settings','Beállítások'],['exports','Export és MCP']];
const statusNames = {waiting:'Várakozó',draft:'Piszkozat',replied:'Megválaszolt',ignored:'Kihagyott',scheduled:'Időzítve',sending:'Küldés alatt',sent:'Elküldve',uncertain:'Bizonytalan',failed:'Sikertelen',new:'Új',contacted:'Megkeresve',qualified:'Releváns',won:'Ügyfél',closed:'Lezárt'};
let state, analytics, config = {}, runtime = {}, csrf = '', days = 28, currentPage = 'overview', followerTab = 'followers', inboxTab = 'waiting', sortBy = 'impressions', searchResults = null, analyzed = null, toastTimer, renderedPage = null;
const inputDrafts = new Map(), skipCapture = new Set();

function button(label, action, data = '', className = '') { return `<button type="button" class="${className}" data-action="${action}" ${data}>${label}</button>`; }
function draftKey(control, page) {
  if (control.id==='ui-language' || ['password','file'].includes(control.type) || ['xClientSecret','xAccessToken','openaiKey'].includes(control.name)) return null;
  const inbox=control.closest('[data-inbox]'), lead=control.closest('[data-lead]'), post=control.closest('[data-post]'), form=control.closest('form');
  const group=inbox ? `inbox:${inbox.dataset.inbox}` : lead ? `lead:${lead.dataset.lead}` : post ? `post:${post.dataset.post}` : form?.getAttribute('id') ? `form:${form.getAttribute('id')}` : 'page';
  const field=control.name || control.id || (control.hasAttribute('data-draft')?'draft':control.hasAttribute('data-reply')?'reply':control.hasAttribute('data-lead-notes')?'notes':control.hasAttribute('data-lead-status')?'status':'');
  return field ? `${page}|${group}|${field}` : null;
}
function captureDrafts() {
  if(!renderedPage)return;
  $$('input,textarea,select',$('#main')).forEach(control=>{const key=draftKey(control,renderedPage);if(key&&![...skipCapture].some(prefix=>key.startsWith(prefix)))inputDrafts.set(key,control.type==='checkbox'?control.checked:control.value);});
  skipCapture.clear();
}
function restoreDrafts() {
  $$('input,textarea,select',$('#main')).forEach(control=>{const key=draftKey(control,currentPage);if(key&&inputDrafts.has(key)){if(control.type==='checkbox')control.checked=inputDrafts.get(key);else control.value=inputDrafts.get(key);}});
  if($('#studio-draft'))$('#studio-count').textContent=html`${$('#studio-draft').value.length} karakter`;
}
function setDraftValue(control, value, page, fallbackKey = '') {
  const key = control ? draftKey(control, page) : fallbackKey;
  if(key)inputDrafts.set(key,value);
  if(page===currentPage) {
    const visible=$$('input,textarea,select',$('#main')).find(item=>draftKey(item,currentPage)===key);
    if(visible)visible.value=value;
    if(key==='studio|page|studio-draft' && $('#studio-count'))$('#studio-count').textContent=html`${value.length} karakter`;
  }
}
function clearDraftGroup(group, page = currentPage) {
  const prefix=`${page}|${group}|`;for(const key of inputDrafts.keys())if(key.startsWith(prefix))inputDrafts.delete(key);skipCapture.add(prefix);
}
function badge(text, color = '') { return `<span class="badge ${color}">${esc(text)}</span>`; }
function empty(title, message, actions = '') { return `<div class="empty"><div class="empty-symbol">◇</div><h3>${esc(title)}</h3><p>${esc(message)}</p>${actions}</div>`; }
function heading(title, subtitle, actions = '') { return `<div class="page-heading"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="heading-actions">${actions}</div></div>`; }
function panel(title, body, aside = '', description = '') { return `<section class="panel"><div class="panel-heading"><div><h2>${title}</h2>${description ? `<small>${esc(description)}</small>` : ''}</div>${aside}</div>${body}</section>`; }
function avatar(user) { return `<span class="avatar" aria-hidden="true">${esc((user?.name || user?.username || 'X').slice(0,2).toUpperCase())}</span>`; }
function identity(user = {}) { return `<div class="identity"><strong>${esc(user.name || user.username || t('Neve nem érhető el'))}</strong><small>${user.username ? `<a href="${profile(user.username)}" target="_blank" rel="noopener noreferrer">@${esc(user.username)} ↗</a>` : t('Ismeretlen szerző')}</small></div>`; }
function author(post) { return state.users.find(user => String(user.id) === String(post.author_id)) || searchResults?.users?.find(user => String(user.id) === String(post.author_id)) || analyzed?.users?.find(user => String(user.id) === String(post.author_id)) || (String(post.author_id) === String(state.account?.id) ? state.account : {}); }
function toast(message, error = false) { const el = $('#toast'); clearTimeout(toastTimer); el.textContent = error ? errorText(message) : message; el.classList.toggle('error', error); el.hidden = false; toastTimer = setTimeout(() => {el.hidden = true;}, error ? 14000 : 4500); }
async function api(path, body) {
  const response = await fetch(path, {method:body === undefined ? 'GET' : 'POST', headers:body === undefined ? {} : {'Content-Type':'application/json','X-CSRF-Token':csrf}, ...(body === undefined ? {} : {body:JSON.stringify(body)})});
  const data = await response.json().catch(() => ({error:t('A kiszolgáló nem értelmezhető választ adott.')}));
  if (!response.ok) throw new Error(errorText(data.error) || html`Kérés sikertelen (${response.status})`);
  return data;
}
async function refresh() {
  const data = await api(`/api/state?days=${days}`);
  state = data.state; window.XautoI18n.setLanguage(state.settings?.language); analytics = data.analytics || {}; config = data.config || {}; runtime = data.runtime || {}; csrf = data.csrf;
  for (const key of ['posts','users','followers','following','events','inbox','queue','feeds','library','leads','products','sessions']) state[key] ||= [];
  render();
}
async function mutate(path, body, message = t('Mentve a helyi munkatérben.'), clearGroup = '') {
  const originPage = currentPage;
  let result;
  try { result = await api(path,body); } catch(error) {
    try { await refresh(); } catch(refreshError) { error.message += t(' A helyi állapot újraolvasása is sikertelen: ') + refreshError.message; }
    throw error;
  }
  if(clearGroup)clearDraftGroup(clearGroup, originPage);
  if(['/api/demo','/api/demo/exit'].includes(path)){inputDrafts.clear();skipCapture.add(`${currentPage}|`);searchResults=null;analyzed=null;}
  await refresh();if(message)toast(message);return result;
}
function navigate(page) { location.hash = pages.some(([id]) => id === page) ? page : 'overview'; }
function syncNotice() {
  const errors=Object.entries(state.sync||{}).filter(([,entry])=>entry?.status==='error');
  const hasWarnings=Object.values(state.sync||{}).some(entry=>entry?.status==='warning' && entry.warnings?.length);
  const warning=hasWarnings ? html`<div class="notice" role="status">A bejegyzések betöltődtek. Néhány hivatkozott poszt adata hiányos lehet az X válaszában; a válaszok és újraközlések besorolása emiatt pontatlan lehet.</div>` : '';
  if(!errors.length)return warning;
  const labels={posts:t('Bejegyzések'),followers:t('Követők'),following:t('Követettek'),inbox:t('Válaszok')};
  return warning + html`<div class="inline-error" role="alert"><strong>Az X-adatok frissítése sikertelen.</strong> A mentett adatok hiányosak vagy elavultak lehetnek.${errors.map(([kind,entry])=>`<p>${esc(labels[kind]||kind)}: ${esc(errorText(entry.error))}</p>`).join('')}${errors.some(([,entry])=>/402/.test(entry.error||''))?t('<p>Az X API-kredit hiányzik vagy elfogyott. Ellenőrizd az X fejlesztői konzol számlázását és kreditegyenlegét, majd indíts kézi szinkronizálást.</p>'):''}</div>`;
}
function pageFromHash(hash, previousPage) {
  const page=hash === '#main' ? previousPage : hash.slice(1) || 'overview';
  return pages.some(([id])=>id===page) ? page : 'overview';
}
function localizeShell() {
  document.documentElement.lang=window.XautoI18n.language;
  $('meta[name="description"]').content=t('Személyes X munkatér: analitika, kapcsolatok, válaszok és tartalomtervezés helyben.');
  $$('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n);});
  $$('[data-i18n-title]').forEach(el=>{el.title=t(el.dataset.i18nTitle);});
  $$('[data-i18n-aria]').forEach(el=>{el.setAttribute('aria-label',t(el.dataset.i18nAria));});
  const guide=$('#guide-link');if(guide)guide.href=window.XautoI18n.language==='en'?'/guide.en.html':'/guide.html';
}
function render() {
  captureDrafts();
  localizeShell();
  currentPage = pageFromHash(location.hash,currentPage);
  $('#nav').innerHTML = pages.map(([id,label],i) => `${i === 8 ? t('<span class="nav-label">MUNKATÉR</span>') : ''}<a href="#${id}" ${id === currentPage ? 'class="active" aria-current="page"' : ''} title="${t(label)}">${icon(id)}<span class="nav-text">${t(label)}</span>${id === 'inbox' && state.inbox.some(item => item.status === 'waiting') ? `<span class="count">${state.inbox.filter(item => item.status === 'waiting').length}</span>` : ''}</a>`).join('');
  $('#breadcrumb').textContent = pages.find(([id]) => id === currentPage)?.[1] && t(pages.find(([id]) => id === currentPage)[1]);
  $('#account').innerHTML = `${avatar(state.account)}<div class="identity"><strong>${esc(state.account?.name || t('Személyes munkatér'))}</strong><small>${state.demo ? t('Mintaadatok · demó') : state.account?.username ? `@${esc(state.account.username)}` : t('X-fiók még nincs csatlakoztatva')}</small></div>`;
  $('#connection').textContent = state.demo ? t('Mintaadatok') : config.paused ? t('Szüneteltetve') : config.xConnected ? t('X csatlakoztatva') : t('Helyi mód');
  $('#connection').className = `badge ${state.demo ? 'pink' : config.xConnected && !config.paused ? 'green' : ''}`;
  $('#stop').textContent = config.paused ? t('▷ Automatizálás folytatása') : t('⏸ Automatizálás szüneteltetése');
  $('#main').innerHTML = syncNotice() + (runtime.backgroundError ? html`<div class="inline-error">Háttérművelet hibája: ${esc(errorText(runtime.backgroundError))}</div>` : '') + ({overview:renderOverview,analytics:renderAnalytics,followers:renderFollowers,inbox:renderInbox,engage:renderEngage,studio:renderStudio,queue:renderQueue,patterns:renderPatterns,leads:renderLeads,settings:renderSettings,exports:renderExports})[currentPage]();
  if (state.demo) {
    $('#main').insertAdjacentHTML('afterbegin',t('<div class="notice">Demó · szintetikus mintaadatok. A profilok és bejegyzések nem valósak; az élő X-hivatkozások és műveletek a demóban nem használhatók.</div>'));
    $$('a[href^="https://x.com"]', $('#main')).forEach(a=>{a.setAttribute('aria-disabled','true');a.title=t('Szintetikus minta; nincs hozzá valós X-bejegyzés.');});
  }
  renderedPage=currentPage;restoreDrafts();
  if($('#follower-filter'))filterFollowers($('#follower-filter').value);
  document.title = `${t(pages.find(([id]) => id === currentPage)?.[1])} · autoX`;
}
function periodSelector() { return html`<div class="segmented" aria-label="Időszak">${[7,14,28].map(n => button(html`${n} nap`,'period',`data-days="${n}"`,n === days ? 'selected' : '')).join('')}</div>`; }
function trend(key) { const now = analytics.totals?.[key], before = analytics.previous?.[key]; if (now == null || before == null || before === 0) return t('Előző időszak: nincs összevethető adat'); const delta = ((now-before)/Math.abs(before))*100; return html`<span class="${delta >= 0 ? 'positive' : 'negative'}">${delta >= 0 ? '↗ +' : '↘ '}${fmt(delta)}%</span> az előző ${days} naphoz képest`; }
function stats() { const totals=analytics.totals || {}; return `<div class="stats">${[[t('Megtekintések'),totals.impressions,'impressions','eye'],[t('Interakciós arány'),totals.engagementRate == null ? null : `${fmt(totals.engagementRate)}%`,'engagementRate','analytics'],[t('Új követők egyenlege'),totals.netFollowers,'netFollowers','followers'],[t('Publikált bejegyzések'),totals.posts,'posts','studio']].map(([label,value,key,i])=>`<div class="stat"><div class="stat-top">${t(label)}${icon(i)}</div><div class="stat-value">${typeof value === 'string' ? esc(value) : fmt(value)}</div><div class="stat-bottom">${trend(key)}</div></div>`).join('')}</div>`; }
function chart() {
  const points = analytics.daily || [], values = points.map(d => d.impressions), available = values.some(v => v != null);
  if (!available) return t('<div class="chart-empty"><p>A megtekintési grafikonhoz még nincs elérhető adat. Csatlakoztasd és frissítsd az X-fiókodat.</p></div>');
  const max = Math.max(...values.filter(v=>v != null),1), x = i=>36+i*(700/Math.max(points.length-1,1)), y=v=>185-(v/max)*155;
  const segments = []; let segment=[]; values.forEach((v,i)=>{if(v == null){if(segment.length)segments.push(segment);segment=[];}else segment.push(`${x(i)},${y(v)}`);}); if(segment.length)segments.push(segment);
  return html`<div class="chart-legend"><span>Megtekintések</span></div><div class="chart"><svg viewBox="0 0 760 210" role="img" aria-label="A publikálási napokra összesített megtekintések"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2dff7d" stop-opacity=".14"/><stop offset="100%" stop-color="#2dff7d" stop-opacity="0"/></linearGradient></defs>${[0,1,2,3].map(n=>`<line x1="36" x2="745" y1="${30+n*52}" y2="${30+n*52}" stroke="#273029" stroke-dasharray="3 5"/><text x="0" y="${34+n*52}" fill="#8b988f" font-size="9">${esc(fmt(max*(1-n/3)))}</text>`).join('')}${segments.map(s=>`<polygon points="${s[0].split(',')[0]},185 ${s.join(' ')} ${s.at(-1).split(',')[0]},185" fill="url(#chart-fill)"/><polyline points="${s.join(' ')}" fill="none" stroke="#2dff7d" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}${values.map((v,i)=>v == null ? '' : html`<circle cx="${x(i)}" cy="${y(v)}" r="2.5" fill="#8efbb7"><title>${esc(points[i].date)}: ${fmt(v)} megtekintés</title></circle>`).join('')}</svg></div><div class="chart-labels">${points.filter((_,i)=>i===0 || i===Math.floor(points.length/2) || i===points.length-1).map(d=>`<span>${esc(d.date)}</span>`).join('')}</div>`;
}
function goalPanel() { const goal = Number(state.settings.goal)||100000, total=analytics.totals?.impressions, pct=total==null ? null : Math.min(100,total/goal*100); return panel(t('Az aktuális célod'),html`<span class="activity-label">ELÉRÉS · ${days} NAP</span><div class="goal-number">${fmt(total)} <small style="font-size:13px;font-weight:400">/ ${fmt(goal)}</small></div><div class="progress"><span style="width:${pct||0}%"></span></div><div class="between"><small>${pct==null ? t('Még nincs mérhető haladás') : html`${fmt(pct)}% teljesítve`}</small><a class="link" href="#settings" style="font-size:10px">Cél szerkesztése ↗</a></div><div class="mini-list"><div class="mini-row"><span>Követők</span><strong>${fmt(analytics.followers?.total)}</strong></div><div class="mini-row"><span>Válaszra vár</span><strong>${state.inbox.filter(i=>i.status==='waiting').length}</strong></div><div class="mini-row"><span>Időzített bejegyzések</span><strong>${state.queue.filter(i=>i.status==='scheduled').length}</strong></div></div><div class="callout"><strong>Következő lépés</strong>${state.inbox.some(i=>i.status==='waiting') ? t('<a href="#inbox">Nézd át a beérkezett válaszokat →</a>') : t('<a href="#studio">Írd meg a következő bejegyzésed →</a>')}</div>`); }
function postTable() { const posts = [...(analytics.topPosts || [])].sort((a,b)=>(b[sortBy]??-1)-(a[sortBy]??-1)); return posts.length ? html`<div class="table-wrap"><table><thead><tr><th>Bejegyzés</th><th>Megtekintés</th><th>Interakció</th><th>Arány</th><th></th></tr></thead><tbody>${posts.slice(0,30).map(p=>html`<tr><td class="post-cell"><p>${esc(p.text)}</p><small>${esc(date(p.created_at))}</small></td><td class="num">${fmt(p.impressions)}</td><td class="num">${fmt(p.engagements)}</td><td class="num">${p.engagementRate==null?'—':fmt(p.engagementRate)+'%'}</td><td><a href="${postURL(p.id)}" target="_blank" rel="noopener noreferrer" aria-label="Bejegyzés megnyitása X-en">↗</a></td></tr>`).join('')}</tbody></table></div>` : empty(t('Itt jelennek meg a bejegyzéseid'),t('Frissítsd a saját posztjaidat az X-kapcsolat beállítása után.')); }
function syncButton(kind='all') { return button(t('↻ Szinkronizálás'),'sync',`data-kind="${kind}"`,'small'); }
function renderOverview() { return heading(t('Egy jó nap a növekedéshez.'),html`${state.account?.username ? '@'+state.account.username+' · ' : ''}A fiókod, a beszélgetéseid és a következő ötleted.`,periodSelector()+syncButton())+(!state.account && !state.posts.length ? html`<div class="welcome"><div><h2>Minden egy helyen. A saját gépeden.</h2><p>Csatlakoztasd az X-fiókodat, vagy ismerd meg a felületet jelölt mintaadatokkal.</p></div><div class="form-actions"><button class="primary small" data-nav="settings">X-kapcsolat beállítása</button>${button(t('Mintaadatok kipróbálása'),'demo','','small')}</div></div>` : state.demo ? html`<div class="notice">Mintaadatokat látsz. Ezek nem a saját fiókod eredményei. ${button(t('Kilépés a demóból'),'exit-demo','','small')}</div>` : '')+stats()+`<div class="grid">${panel(t('Elérés áttekintése'),chart()+t('<p class="chart-note">A publikálási naponként összesített aktuális metrika; nem az adott napon keletkezett elérés. A hiányzó adatot — jelöli.</p>'),badge(html`${days} nap`),t('Hogyan teljesítenek a bejegyzéseid?'))}${goalPanel()}</div>`+panel(t('Legjobb bejegyzések'),postTable(),html`<a class="link" href="#analytics" style="font-size:11px">Összes elemzése →</a>`); }
function renderAnalytics() { const hours=analytics.bestHours || []; return heading(t('Analitika'),t('Értsd meg, mi működik a közönségednél.'),periodSelector()+syncButton('posts'))+stats()+panel(t('Megtekintések időben'),chart()+t('<p class="chart-note">UTC publikálási napokra csoportosított aktuális összesített metrikák. A hiányzó megtekintések nem nullák.</p>'))+panel(t('Bejegyzések teljesítménye'),postTable(),html`<label>Rendezés<select id="post-sort"><option value="impressions" ${sortBy==='impressions'?'selected':''}>Megtekintés</option><option value="engagements" ${sortBy==='engagements'?'selected':''}>Interakció</option><option value="engagementRate" ${sortBy==='engagementRate'?'selected':''}>Interakciós arány</option></select></label>`)+panel(t('Publikálási időminták'),hours.length ? html`<p class="secondary-text">A mentett bejegyzésekből számítva, UTC szerint. Kis mintánál ez támpont.</p><div class="hour-grid">${hours.map(h=>html`<div class="hour">${Number(h.hour)}:00<strong>${fmt(h.impressions)}</strong><span>${fmt(h.posts)} poszt</span></div>`).join('')}</div>` : empty(t('Még nincs időminta'),t('A saját bejegyzések frissítése után jelenik meg.'))); }
function userFrom(value) { return typeof value === 'object' ? value : state.users.find(u=>String(u.id)===String(value)) || {id:value}; }
function renderFollowers() {
  const ids = new Set(state.followers.map(v=>String(typeof v === 'object' ? v.id : v))), followed = new Set(state.following.map(v=>String(typeof v === 'object' ? v.id : v)));
  const list = followerTab==='following' ? state.following : followerTab==='not-back' ? state.following.filter(v=>!ids.has(String(typeof v==='object'?v.id:v))) : followerTab==='mutual' ? state.followers.filter(v=>followed.has(String(typeof v==='object'?v.id:v))) : state.followers;
  return heading(t('Követők'),t('Valódi kapcsolatok. Átlátható változások.'),syncButton('followers'))+html`<div class="toolbar"><div class="tabs">${[['followers',t('Követők')],['following',t('Követettek')],['mutual',t('Kölcsönös')],['not-back',t('Nem követ vissza')],['events',t('Változások')]].map(([id,label])=>button(label,'follower-tab',`data-tab="${id}"`,followerTab===id?'selected':'')).join('')}</div><input id="follower-filter" type="search" placeholder="Keresés név vagy felhasználónév alapján" aria-label="Követők szűrése"></div>`+(!state.relationshipBaseline ? t('<div class="notice">Az első teljes letöltés alapállapotot rögzít. Követővesztés csak ismételt, teljes ellenőrzés után jelenik meg.</div>'):'')+panel(followerTab==='events'?t('Kapcsolati változások'):t('Kapcsolatok'),followerTab==='events' ? (state.events.length ? `${button(t('Mind olvasottnak jelölése'),'read-events','','small')}<div>${[...state.events].reverse().map(e=>{const u=userFrom(e.userId);return `<div class="list-row filterable" data-filter="${esc((u.name||'')+' '+(u.username||''))}">${avatar(u)}${identity(u)}${badge(e.type==='follow'?t('Követni kezdett'):t('Már nem követ'),e.type==='follow'?'green':'red')}<small>${esc(date(e.observedAt))}${!e.read?t(' · új'):''}</small></div>`;}).join('')}</div>` : empty(t('Még nincs változás'),t('A következő teljes szinkronizálások összehasonlításából készül a napló.'))) : list.length ? list.map(v=>{const u=userFrom(v), isFollowing=followed.has(String(u.id));return html`<div class="list-row filterable" data-filter="${esc((u.name||'')+' '+(u.username||''))}">${avatar(u)}${identity(u)}<span class="count-text">${fmt(u.public_metrics?.followers_count)} követő</span>${button(isFollowing?t('Kikövetés'):t('Követés'),'follow',`data-id="${esc(u.id)}" data-follow="${!isFollowing}"`,'small')}</div>`;}).join('') : empty(t('Nincs megjeleníthető kapcsolat'),t('Frissítsd a követőlistádat, vagy válassz másik szűrőt.')));
}
function inboxCard(item) { const p=item.post || {}, u=item.author || author(p); return html`<article class="item-card" data-inbox="${esc(item.id)}"><div class="item-head">${avatar(u)}${identity(u)}${badge(t(statusNames[item.status]||item.status),item.status==='waiting'?'pink':'')}</div><p class="item-text">${esc(p.text)}</p>${p.conversation_id && p.conversation_id!==p.id ? html`<div class="context">Beszélgetés: <a class="link" href="${postURL(p.conversation_id)}" target="_blank" rel="noopener noreferrer">eredeti szál megnyitása ↗</a></div>`:''}<div class="item-meta"><span>${esc(date(p.created_at))}</span><a href="${postURL(p.id||item.id)}" target="_blank" rel="noopener noreferrer">Megnyitás X-en ↗</a></div><label>Válaszod<textarea data-draft placeholder="Írj személyes, hasznos választ…">${esc(item.draft)}</textarea></label><div class="item-footer">${button(t('Piszkozat mentése'),'inbox-save')}${button('✦ AI-javaslat','inbox-ai')}${button(t('Küldési sorba →'),'inbox-queue','','primary')}${button(t('Megválaszolt'),'inbox-status','data-status="replied"')}${button(t('Kihagyás'),'inbox-status','data-status="ignored"')}${item.status!=='waiting'?button(t('Vissza a várakozókhoz'),'inbox-status','data-status="waiting"'):''}</div></article>`; }
function renderInbox() { const items=state.inbox.filter(i=>inboxTab==='all'||i.status===inboxTab); return heading(t('Beszélgetések, amik számítanak.'),t('Válaszolj átgondoltan, a saját hangodon.'),syncButton('inbox')+button(t('✦ Kérdések összegzése'),'summarize-inbox','','small'))+`<div class="tabs">${[['waiting',t('Várakozó')],['draft',t('Piszkozatok')],['replied',t('Megválaszolt')],['ignored',t('Kihagyott')],['all',t('Összes')]].map(([id,label])=>button(`${t(label)} <span class="count-text">${id==='all'?state.inbox.length:state.inbox.filter(i=>i.status===id).length}</span>`,'inbox-tab',`data-tab="${id}"`,inboxTab===id?'selected':'')).join('')}</div><div class="stack">${items.length?items.map(inboxCard).join(''):empty(t('Tiszta a postaládád'),t('A frissítés betölti az elérhető említéseket. A beszélgetések teljes mélysége az X API-hozzáférésedtől függ.'),syncButton('inbox'))}</div>`; }
function resultCard(p) { const u=author(p); return html`<article class="item-card" data-post="${esc(p.id)}"><div class="item-head">${avatar(u)}${identity(u)}<small>${esc(date(p.created_at))}</small></div><p class="item-text">${esc(p.text)}</p><div class="item-meta"><span>♡ ${fmt(p.public_metrics?.like_count)}</span><span>↩ ${fmt(p.public_metrics?.reply_count)}</span><span>↗ ${fmt(p.public_metrics?.impression_count)}</span></div><label>Választervezet<textarea data-reply placeholder="Kapcsolódj a beszélgetéshez…"></textarea></label><div class="item-footer">${button(t('✦ AI-válasz'),'result-ai')}${button(t('Válasz a sorba'),'result-queue','','primary')}${button(t('Inspiráció mentése'),'save-inspiration')}${button(t('Lead mentése'),'save-lead')}<a href="${postURL(p.id)}" target="_blank" rel="noopener noreferrer">Megnyitás X-en ↗</a></div></article>`; }
function renderEngage() { return heading(t('Találd meg a következő beszélgetést.'),t('Keress témára, kérdésre vagy azokra, akiknek segíthetsz.'))+panel(t('Keresés az X-en'),html`<form id="search-form"><div class="search-bar"><label>Keresőkifejezés<input name="query" required placeholder='Például: "indie hacker" -is:retweet'></label><button class="primary" type="submit">Keresés ↗</button></div><div class="form-grid" style="margin-top:16px"><label>Nyelv<select name="language"><option value="">Bármely nyelv</option><option value="hu">Magyar</option><option value="en">Angol</option><option value="de">Német</option></select></label><label>Időszak<select name="age"><option value="">Elérhető friss bejegyzések</option><option value="1">Elmúlt nap</option><option value="3">Elmúlt 3 nap</option><option value="7">Elmúlt 7 nap</option></select></label><label class="checkbox-label"><input name="excludeReplies" type="checkbox"> Válaszok kizárása</label><label class="checkbox-label"><input name="hideReplied" type="checkbox" checked> Már megválaszoltak elrejtése</label></div></form><div class="divider"></div><div class="between"><h3>Mentett keresések</h3>${button(t('Aktuális keresés mentése'),'save-feed','','small')}</div><div class="pill-list">${state.feeds.length?state.feeds.map(f=>`<span>${button(esc(f.name||f.query),'load-feed',`data-id="${esc(f.id)}"`)}${button('×','delete-collection',html`data-collection="feeds" data-id="${esc(f.id)}" aria-label="Keresés törlése"`,'quiet')}</span>`).join(''):t('<small>Mentsd el a témákat, amelyekhez gyakran visszatérsz.</small>')}</div>`)+`<div id="search-output" class="stack">${searchResults?.hasMore?html`<p class="notice">Az első 100 találat látható. Nincs automatikus továbblapozás; szűkítsd a keresést a további API-költségek korlátozásához.</p>`:''}${searchResults ? (searchResults.posts.length ? html`<p class="count-text">${fmt(searchResults.posts.length)} találat · ${esc(searchResults.query||'')}</p>`+searchResults.posts.map(resultCard).join('') : empty(t('Nem találtunk bejegyzést'),t('Próbálj tágabb keresést, vagy ellenőrizd a hozzáférést.'))) : empty(t('A jó kapcsolat egy beszélgetéssel kezdődik.'),t('A keresés akkor indul, amikor megnyomod a Keresés gombot.'))}</div>`; }
function collectionCards(collection, title, textKey='text') {
  const items=state[collection];
  return panel(title,items.length?`<div class="stack">${items.map(i=>`<article><div class="between"><h3>${esc(i.name||i.title||i.username||t('Mentett elem'))}</h3>${button(t('Törlés'),'delete-collection',`data-collection="${collection}" data-id="${esc(i.id)}"`,'quiet small')}</div>
    <p class="saved-text secondary-text">${esc(i[textKey]||i.description||i.text||i.analysis||'')}</p>
    ${i.postId?html`<a class="link" href="${postURL(i.postId)}" target="_blank" rel="noopener noreferrer" style="font-size:10px">Eredeti bejegyzés ↗</a>`:''}
    ${['library','sessions'].includes(collection)?`<div class="form-actions">${button(t('Szerkesztés a Studioban'),'load-material',`data-collection="${collection}" data-id="${esc(i.id)}"`,'small')}</div>`:''}</article>`).join('')}</div>`:empty(t('A könyvtárad még üres'),t('Ments inspirációt az Engage találatai közül, vagy adj hozzá saját anyagot.')));
}
function renderStudio() { return heading(t('Az ötlettől a következő posztig.'),t('Írj, finomíts és tervezz a saját hangodon.'),badge(config.openaiConfigured?t('OpenAI csatlakoztatva'):t('AI-kulcs nincs beállítva'),config.openaiConfigured?'green':''))+`<div class="grid">${panel(t('Íróasztal'),html`<form id="studio-form" class="stack"><label>Mit szeretnél megírni?<textarea name="prompt" required placeholder="Egy rövid bejegyzés arról, amit ma tanultam a terméképítésről…"></textarea></label><div class="form-grid"><label>Formátum<select name="mode"><option value="post">Bejegyzés</option><option value="reply">Válasz</option><option value="rewrite">Átírás</option><option value="ideas">Ötletek</option></select></label><label>Termékkontextus<select name="product"><option value="">Nincs kiválasztva</option>${state.products.map(p=>`<option value="${esc(p.id)}">${esc(p.name||t('Termék'))}</option>`).join('')}</select></label></div><button type="submit" class="primary">✦ Tervezet készítése</button></form><div class="divider"></div><label>Szerkeszthető tervezet<textarea id="studio-draft" placeholder="Írj ide saját szöveget, vagy készíts AI-tervezetet…" style="min-height:190px"></textarea></label><div class="form-actions">${button(t('Közzététel most'),'studio-publish','','primary')}${button(t('Küldési sorba →'),'studio-queue')}${button(t('Mentés inspirációként'),'studio-save')}${button(t('Másolás'),'copy','data-source="studio-draft"','quiet small')}<small id="studio-count">0 karakter</small></div>`)}<div>${panel(t('A te hangod'),html`<p class="secondary-text">${esc(state.settings.style||t('Még nincs megadva stílusleírás. Írd le, hogyan fogalmazol, kinek írsz és mit szeretnél kerülni.'))}</p><div class="form-actions"><button data-nav="settings" class="small">Stílus beállítása ↗</button></div><div class="callout"><strong>A kontextus számít.</strong>A saját stílusod, a mentett inspirációk és a kiválasztott termék segítik a tervezetet. Küldés előtt mindig átnézheted.</div>`)}${panel(t('Termék vagy szolgáltatás'),html`<form id="product-form" class="stack"><label>Név<input name="name" required placeholder="A terméked neve"></label><label>Mit kínálsz, és kinek?<textarea name="description" required placeholder="Probléma, megoldás, célközönség, hivatkozás…"></textarea></label><button type="submit">Termék mentése</button></form>`)}</div></div><div class="grid equal">${collectionCards('library',t('Inspirációs könyvtár'))}${collectionCards('products',t('Mentett termékek'),'description')}</div>`+collectionCards('sessions',t('Mentett írói munkamenetek és kérdéscsoportok')); }
function composeForm() {
  return html`<form id="queue-form"><input type="hidden" name="id"><div class="form-grid">
    <label>Típus<select name="kind" id="queue-kind"><option value="post">Új bejegyzés</option><option value="reply">Válasz</option><option value="dm">Privát üzenet · kézi küldés</option></select></label>
    <label>Címzett / bejegyzésazonosító<input name="target" placeholder="Válaszhoz poszt ID, DM-hez @felhasználónév"></label>
    <label class="wide">Szöveg<textarea name="text" required maxlength="10000" placeholder="Mi jár a fejedben?"></textarea></label>
    <label>Időzítés (opcionális)<input name="scheduledAt" type="datetime-local"><small>A helyi gépnek és az alkalmazásnak futnia kell.</small></label>
    <label>Feltöltött médiaazonosítók<input name="mediaIds" placeholder="Opcionális X média ID, vesszővel elválasztva"><small>Legfeljebb 4 kép; DM-nél kézzel csatold az X-en.</small></label>
    <div class="wide"><label>Kép csatolása<input id="queue-image" type="file" accept="image/png,image/jpeg,image/webp"></label><div class="form-actions">${button(t('Kép feltöltése az X-re'),'upload-image','','small')}<small id="upload-status">PNG, JPEG vagy WebP · legfeljebb 5 MB</small></div></div>
    </div><div class="form-actions"><button class="primary" type="submit" name="intent" value="publish">Közzététel most</button><button type="submit" name="intent" value="save">Mentés a sorba</button>${button(t('Új tervezet'),'reset-composer','','quiet')}<small id="composer-note">Közzététel most: azonnali küldés megerősítéssel. Mentés a sorba: piszkozat vagy időzítés.</small></div></form>`;
}
function manualURL(item) { if(item.kind==='dm') return `https://x.com/messages/compose${/^\d+$/.test(item.targetId||'')?'?recipient_id='+encodeURIComponent(item.targetId):''}`; return `https://x.com/intent/tweet?text=${encodeURIComponent(item.text||'')}${item.kind==='reply'?'&in_reply_to='+encodeURIComponent(item.targetId||''):''}`; }
function queueCard(item) {
  const editable=['draft','scheduled','failed'].includes(item.status), attrs=`data-id="${esc(item.id)}"`;
  return html`<article class="item-card"><div class="item-head"><div class="identity"><strong>${item.kind==='reply'?t('↩ Válasz'):item.kind==='dm'?t('✉ Privát üzenet'):t('✎ Bejegyzés')}${item.username?' · @'+esc(item.username):''}</strong><small>${item.scheduledAt?t('Időzítés: ')+esc(date(item.scheduledAt)):esc(date(item.createdAt))}</small></div>${badge(t(statusNames[item.status]||item.status),['uncertain','failed'].includes(item.status)?'red':item.status==='sent'?'green':item.status==='scheduled'?'pink':'')}</div>
    <p class="item-text">${esc(item.text)}</p>${item.mediaIds?.length?html`<p class="field-help">${fmt(item.mediaIds.length)} csatolt kép</p>`:''}
    ${item.kind==='dm'?t('<p class="field-help">Másold a szöveget, nyisd meg az X-et, válaszd ki a címzettet, és illeszd be az üzenetet.</p>'):''}
    ${item.error?`<div class="inline-error">${esc(errorText(item.error))}</div>`:''}${item.status==='uncertain'?t('<p class="field-help">Ellenőrizd az X-en, megjelent-e. A program nem próbálja újra automatikusan.</p>'):''}
    <div class="item-footer"><a href="${manualURL(item)}" target="_blank" rel="noopener noreferrer">Megnyitás X-en ↗</a>
    ${button(t('Szöveg másolása'),'copy-item',attrs)}${editable?button(t('Szerkesztés'),'edit-queue',attrs):''}
    ${editable&&item.kind!=='dm'?button(t('Küldés most'),'queue-action',`${attrs} data-queue-action="send"`,'primary'):''}
    ${item.status!=='sent'?button(t('Elküldöttként jelölés'),'queue-action',`${attrs} data-queue-action="sent"`):''}
    ${item.status==='scheduled'?button(t('Időzítés törlése'),'queue-action',`${attrs} data-queue-action="cancel"`):''}
    ${item.status!=='sending'?button(t('Törlés'),'queue-action',`${attrs} data-queue-action="delete"`,'quiet'):''}</div></article>`;
}
function renderQueue() { return heading(t('Küldési sor'),t('Minden gondolatnak legyen jó időzítése.'),badge(config.paused?t('Automatizálás szünetel'):t('Helyi időzítő'),config.paused?'':'green'))+panel(t('Új tervezet'),composeForm())+html`<p class="section-note">Az időzített posztot és választ a futó program küldi. A privát üzenetet az X-en tudod elküldeni; a szöveg másolható.</p><div class="stack">${state.queue.length?[...state.queue].reverse().map(queueCard).join(''):empty(t('A sorod még üres'),t('Ments egy tervezetet itt, vagy küldd át a Studio és a Válaszok felületről.'))}</div>`; }
function renderPatterns() { return heading(t('Figyelj meg. Tanulj. Alakítsd a sajátodra.'),t('Nyilvános fiókok és saját tartalmak mintái.'))+panel(t('Fiók elemzése'),html`<form id="analyze-form"><div class="search-bar"><label>X felhasználónév<input name="username" required placeholder="@felhasználónév"></label><button type="submit" class="primary">Elemzés betöltése</button></div></form><div class="form-actions">${button(t("Saját posztjaim elemzése"),"own-patterns","","small")}</div><p class="field-help">Nyilvános posztokat kér le. AI-értelmezés külön gombbal indítható.</p>`)+(analyzed?panel(html`${esc(analyzed.account?.name||analyzed.account?.username||t('Fiók'))} · minták`,`<div class="item-head">${avatar(analyzed.account)}${identity(analyzed.account)}${badge(html`${fmt(analyzed.posts?.length||0)} bejegyzés`)}</div>${analyzed.analysis?`<p class="saved-text item-text">${esc(analyzed.analysis)}</p>`:t('<p class="secondary-text">Tekintsd át a bejegyzéseket, vagy kérj AI-összefoglalót a hangnemről, témákról és nyitómondatokról.</p>')}<div class="form-actions">${button(t('✦ Minták összefoglalása'),'analyze-ai')}${button(t('Elemzés mentése'),'save-analysis')}</div>`)+`<div class="stack">${(analyzed.posts||[]).slice(0,12).map(resultCard).join('')}</div>`:empty(t('Kinek a tartalmából tanulnál?'),t('Írj be egy nyilvános felhasználónevet. Az elérhető adatok az X-hozzáférésedtől függnek.')))+`<div style="margin-top:20px">${collectionCards('sessions',t('Mentett elemzések'),'analysis')}</div>`; }
function renderLeads() { return heading(t('Kapcsolatokból lehetőségek.'),t('Nyilvános beszélgetésekből mentett kapcsolatok és saját jegyzeteid.'))+panel(t('Új kapcsolat'),html`<form id="lead-form"><div class="form-grid"><label>Név<input name="name" required placeholder="Név"></label><label>X felhasználónév<input name="username" required placeholder="@felhasználónév"></label><label class="wide">Jegyzet<textarea name="notes" placeholder="Miért releváns? Mi legyen a következő lépés?"></textarea></label></div><div class="form-actions"><button type="submit" class="primary">Kapcsolat mentése</button></div></form>`)+panel(t('Leadlista'),state.leads.length ? `<div class="stack">${state.leads.map(l=>html`<article class="item-card" data-lead="${esc(l.id)}"><div class="item-head">${avatar(l)}${identity(l)}<label>Státusz<select class="status-select" data-lead-status>${['new','contacted','qualified','won','closed'].map(s=>`<option value="${s}" ${l.status===s?'selected':''}>${t(statusNames[s])}</option>`).join('')}</select></label></div><label>Jegyzet<textarea data-lead-notes>${esc(l.notes||l.note)}</textarea></label><div class="item-footer">${button(t('Mentés'),'lead-save')}${button(t('DM tervezet'),'lead-dm')}${button(t('Törlés'),'delete-collection',`data-collection="leads" data-id="${esc(l.id)}"`,'quiet')}</div></article>`).join('')}</div>` : empty(t('Még nincs mentett kapcsolat'),t('Az Engage találatoknál menthetsz szerzőket, vagy felvehetsz saját kapcsolatot.')));
}
function renderSettings() { return heading(t('Beállítások'),t('A saját munkatér, a saját ritmusod.'))+panel(t('Nyelv'),html`<label for="ui-language">${t('Nyelv')}</label><select id="ui-language"><option value="hu" ${window.XautoI18n.language==='hu'?'selected':''}>${'Magyar'}</option><option value="en" ${window.XautoI18n.language==='en'?'selected':''}>English</option></select>`)+`<div class="grid equal"><div>${panel(t('X-kapcsolat'),html`<div class="setting-status"><span class="secondary-text">${state.account?.username?'@'+esc(state.account.username):t('Nincs csatlakoztatott fiók')}</span>${badge(config.xConnected?t('Csatlakoztatva'):t('Nincs kapcsolat'),config.xConnected?'green':'')}</div><form id="x-settings-form" class="stack"><label>OAuth Client ID<input name="xClientId" value="${esc(config.xClientId||'')}" autocomplete="off"></label><label>OAuth Client Secret (ha szükséges)<input name="xClientSecret" type="password" autocomplete="new-password" placeholder="Üresen hagyva változatlan"></label><label>Felhasználói Access Token (opcionális)<input name="xAccessToken" type="password" autocomplete="new-password" placeholder="Üresen hagyva változatlan"><small>Felhasználói jogosultságú token szükséges; alkalmazás-bearer önmagában nem elég.</small></label><button type="submit">Kapcsolati beállítások mentése</button></form><div class="form-actions">${button(t('X-fiók csatlakoztatása ↗'),'connect','','primary')}</div><div class="divider"></div><div class="docs"><h3>Gyors beállítás</h3><ol><li>Az <a href="https://console.x.com/" target="_blank" rel="noopener noreferrer">X Developer felületén</a> engedélyezd az OAuth 2.0 felhasználói hozzáférést.</li><li>Add meg ezt a visszahívási címet: <code>${esc(config.redirectUri||location.origin+'/oauth/callback')}</code></li><li>Mentsd a Client ID-t, majd kattints a csatlakoztatásra.</li><li>Engedélyezés után az Áttekintésen indíts szinkronizálást.</li></ol><p>Az elérhető végpontokat és díjakat a saját X API-csomagod határozza meg.</p></div>`)}${panel(t('Automatizálás'),html`<div class="setting-status"><span>${config.paused?t('Szüneteltetve'):t('Engedélyezve')}</span>${badge(config.paused?t('Szünet'):t('Aktív'),config.paused?'':'green')}</div><p class="secondary-text">Az időzített küldéshez a gépnek és ennek a programnak futnia kell. A szüneteltetés az időzített küldést állítja meg. X-adatfrissítés csak kézzel indul.</p><div class="form-actions">${button(config.paused?t('Automatizálás folytatása'):t('Automatizálás szüneteltetése'),'toggle-pause','','small')}</div>`)}</div><div>${panel(t('OpenAI és saját stílus'),html`<div class="setting-status"><span class="secondary-text">API-kulcs</span>${badge(config.openaiConfigured?t('Beállítva'):t('Nincs beállítva'),config.openaiConfigured?'green':'')}</div><form id="ai-settings-form" class="stack"><label>OpenAI API-kulcs<input name="openaiKey" type="password" autocomplete="new-password" placeholder="Üresen hagyva változatlan"></label><label>Modell<input name="model" required value="${esc(state.settings.model||config.model||'gpt-4.1-mini')}"></label><label>Saját stílusleírás<textarea name="style" placeholder="Kinek írsz? Hogyan fogalmazol? Mit kerüljön a javaslat?">${esc(state.settings.style)}</textarea></label><button type="submit">AI-beállítások mentése</button></form><p class="field-help">Az AI-kérés a gombra kattintva, jóváhagyás után indul. A saját OpenAI-fiókodban költsége lehet.</p>`)}${panel(t('Célok és korlátok'),html`<form id="general-settings-form" class="stack"><label>Eléréscél a kiválasztott időszakra<input type="number" name="goal" min="1" required value="${Number(state.settings.goal)||100000}"></label><p class="field-help">X-adatok frissítése: kizárólag kézzel, külön jóváhagyással. Az oldal megnyitása és a felső Frissítés gomb csak helyi adatokat olvas.</p><label>Napi API-küldési korlát<input type="number" name="dailyWriteLimit" min="0" max="100" required value="${state.settings.dailyWriteLimit==null?20:Number(state.settings.dailyWriteLimit)}"></label><button type="submit">Célok mentése</button></form>`)}${panel(t('Helyi adatok'),html`<p class="secondary-text">Az adatok és a szerveroldali titkok a saját gépeden maradnak. A kulcsokat a felület nem olvassa vissza.</p>${config.dataDir?html`<p class="field-help">Adatkönyvtár:</p><code class="code-block">${esc(config.dataDir)}</code>`:''}<div class="form-actions"><button data-nav="exports" class="small">Adatok exportálása →</button>${state.demo?button(t('Kilépés a mintaadatokból'),'exit-demo','','small'):''}</div>`)}</div></div>`; }
function renderExports() { return heading(t('Adataid, szabadon.'),t('Helyi export és olvasási hozzáférés a mentett munkatérhez.'))+`<div class="grid equal">${panel(t('Munkatér exportálása'),html`<p class="secondary-text">A JSON a teljes mentett munkateret, a CSV a bejegyzések elérhető metrikáit tartalmazza. A titkos kulcsok nem részei az exportnak.</p><div class="form-actions"><a class="primary" style="padding:9px 14px;border-radius:8px" href="/api/export?format=json" download>JSON letöltése ↓</a><a class="link" href="/api/export?format=csv" download>Bejegyzések CSV ↓</a></div><div class="divider"></div><ul class="help-list"><li>${fmt(state.posts.length)} bejegyzés<small>A hiányzó metrikák az exportban is hiányzó adatok.</small></li><li>${fmt(state.inbox.length)} beérkezett elem<small>Piszkozatokkal és feldolgozási státusszal.</small></li><li>${fmt(state.queue.length)} elem a küldési sorban<small>A bizonytalan küldések állapota is megmarad.</small></li></ul>`)}${panel(t('Helyi MCP · csak olvasás'),html`<p class="secondary-text">Az MCP-felület a helyben mentett adatok olvasására szolgál. A csatlakozás pontos indítóparancsát az alkalmazás README-je tartalmazza.</p><div class="callout"><strong>Meglévő adatokra támaszkodik</strong>Az elemzések frissessége az utolsó sikeres szinkronizálástól függ. Az MCP nem indít önálló küldést.</div><ul class="help-list"><li>Analitika és bejegyzések<small>Időszakok, rangsorok és rendelkezésre álló metrikák.</small></li><li>Kapcsolatok és válaszok<small>Mentett állapot, változásnapló és munkalista.</small></li><li>Küldési sor<small>A mentett piszkozatok és időzítések szövege.</small></li></ul>`)}</div>`; }

async function ai(prompt, context = {}, mode = 'post') { if(!config.openaiConfigured) throw new Error(t('Előbb add meg az OpenAI API-kulcsot a Beállításokban.')); if(!confirm(t('AI-javaslat készítése az OpenAI API-val? Ez a saját API-fiókodban költséget jelenthet.'))) return null; return (await api('/api/ai',{prompt,context,mode})).text; }
function getPost(id) { return [...(searchResults?.posts||[]),...(analyzed?.posts||[]),...state.posts].find(p=>String(p.id)===String(id)); }
let publishingNow = false;
async function publishNow(item, clearGroup) {
  if(publishingNow)return;
  if(!item.text?.trim())throw new Error(t('Írj szöveget a tervezetbe.'));
  if(item.kind==='dm')throw new Error(t('A privát üzenetet az X-en nyisd meg és küldd el.'));
  if(state.demo || !state.account || !config.xConnected)throw new Error(t('Élő közzétételhez csatlakoztasd a saját X-fiókodat.'));
  if(config.paused)throw new Error(t('A küldés szünetel. A Beállításokban indíthatod újra.'));
  if(!confirm(t('Most közzéteszed az X-en? Ez élő, fizetős API-művelet lehet.')+'\n\n@'+state.account.username+'\n\n'+item.text))return;
  const originPage=currentPage;
  captureDrafts();
  const prefix=`${originPage}|${clearGroup}|`;
  const submittedDrafts=[...inputDrafts].filter(([key])=>key.startsWith(prefix));
  publishingNow=true;
  try {
    const saved=await api('/api/queue',{item:{...item,status:'draft',scheduledAt:null}});
    captureDrafts();
    if(submittedDrafts.every(([key,value])=>inputDrafts.get(key)===value))clearDraftGroup(clearGroup,originPage);
    await mutate('/api/queue/action',{id:saved.id,action:'send'},t('Küldési művelet feldolgozva. Ellenőrizd az elem állapotát.'));
    navigate('queue');
  } catch(error) {
    try { await refresh(); } catch { /* Keep the original delivery error. */ }
    navigate('queue');
    throw error;
  } finally { publishingNow=false; }
}
async function addQueue(text, kind='post', targetId='', username='') { if(!text.trim()) throw new Error(t('Írj szöveget a tervezetbe.')); await mutate('/api/queue',{item:{kind,text,targetId,username,status:'draft'}},t('Tervezet mentve a küldési sorba.')); }
async function collection(collectionName, item, clearGroup = '') { return mutate('/api/collection',{collection:collectionName,item},t('Mentve a helyi munkatérben.'),clearGroup); }
function formValues(form) { return Object.fromEntries(new FormData(form)); }
async function handleAction(el) {
  const action=el.dataset.action, id=el.dataset.id, originPage=currentPage;
  if(action==='period'){days=Number(el.dataset.days);await refresh();}
  else if(action==='demo'){await mutate('/api/demo',{},t('Mintaadatok betöltve. Ezek szintetikus adatok.'));}
  else if(action==='exit-demo'){if(confirm(t('Kilépsz a demóból? A mintaadatokat eltávolítjuk; ezután saját fiókot csatlakoztathatsz.')))await mutate('/api/demo/exit',{},t('Üres saját munkatér megnyitva.'));}
  else if(action==='sync'){if(!confirm(t('Lekéred az X aktuális adatait? Ez fizetős API-kéréseket indíthat. Egy teljes szinkron több tucat lapozott kérést is jelenthet.')))return;await mutate('/api/sync',{kind:el.dataset.kind||'all',confirmed:true},t('Szinkronizálás befejezve.'));}
  else if(action==='connect'){const result=await api('/api/connect',{});location.assign(result.url);}
  else if(action==='toggle-pause'){await togglePause();}
  else if(action==='follower-tab'){followerTab=el.dataset.tab;render();}
  else if(action==='inbox-tab'){inboxTab=el.dataset.tab;render();}
  else if(action==='follow'){if(confirm(html`Élő X-művelet: ${el.dataset.follow==='true'?t('követed'):t('kiköveted')} ezt a fiókot?`))await mutate('/api/follow',{userId:id,follow:el.dataset.follow==='true'},t('Kapcsolat módosítva.'));}
  else if(action==='read-events'){await mutate('/api/events/read',{});}
  else if(action==='summarize-inbox'){
    const pending=state.inbox.filter(i=>['waiting','draft'].includes(i.status));if(!pending.length)throw new Error(t('Nincs feldolgozásra váró kérdés.'));
    const text=await ai(t('Csoportosítsd a beérkezett kérdéseket témánként. Minden csoporthoz adj rövid, szerkeszthető válaszmintát. A termékkontextust csak releváns esetben használd; ne találj ki állításokat.'),{questions:pending.map(i=>({id:i.id,text:i.post?.text,draft:i.draft})),products:state.products},'questions');
    if(text!=null){await collection('sessions',{title:t('Beérkezett kérdések · ')+new Date().toLocaleDateString(locale()),text,kind:'questions'});navigate('studio');}
  }
  else if(action==='own-patterns'){analyzed={account:state.account,posts:state.posts,users:state.users,analysis:null};render();}
  else if(action.startsWith('inbox-')){
    const card=el.closest('[data-inbox]'), item=state.inbox.find(i=>String(i.id)===card.dataset.inbox), draft=$('[data-draft]',card).value;
    if(action==='inbox-ai'){const text=await ai(t('Írj egy hasznos, személyes választ a bejegyzésre. Ha van tervezet, finomítsd.'),{post:item.post,draft,products:state.products},'reply');if(text!=null)setDraftValue($('[data-draft]',card),text,originPage);}
    if(action==='inbox-save'||action==='inbox-status')await mutate('/api/inbox',{id:item.id,draft,status:action==='inbox-save'?'draft':el.dataset.status},t('Válasz elmentve.'),`inbox:${item.id}`);
    if(action==='inbox-queue'){await api('/api/inbox',{id:item.id,draft,status:'draft'});await addQueue(draft,'reply',item.post?.id||item.id);}
  }
  else if(action==='queue-action'){
    const a=el.dataset.queueAction;
    if(a==='send'&&!confirm(t('Jóváhagyod ennek a bejegyzésnek vagy válasznak az azonnali, élő elküldését az X-en?')))return;
    if(a==='sent'&&!confirm(t('Ellenőrizted az X-en, hogy ezt az elemet már elküldted?')))return;
    if(a==='delete'&&!confirm(t('Törlöd ezt az elemet a helyi küldési sorból?')))return;
    await mutate('/api/queue/action',{id,action:a},a==='send'?t('Küldési művelet feldolgozva. Ellenőrizd az elem állapotát.'):t('Küldési sor frissítve.'));
  }
  else if(action==='copy'){await navigator.clipboard.writeText($('#'+el.dataset.source).value);toast(t('Szöveg másolva.'));}
  else if(action==='copy-item'){await navigator.clipboard.writeText(state.queue.find(i=>String(i.id)===id)?.text||'');toast(t('Szöveg másolva.'));}
  else if(action==='edit-queue'){
    const item=state.queue.find(i=>String(i.id)===id),form=$('#queue-form');
    form.elements.id.value=item.id;form.elements.kind.value=item.kind;form.elements.target.value=item.kind==='dm'?(item.username||item.targetId):item.targetId||'';form.elements.text.value=item.text;form.elements.mediaIds.value=(item.mediaIds||[]).join(',');
    form.elements.scheduledAt.value=item.scheduledAt?new Date(new Date(item.scheduledAt).getTime()-new Date(item.scheduledAt).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
    $('#composer-note').textContent=t('Meglévő tervezet szerkesztése. A mentés ezt az elemet frissíti.');form.scrollIntoView({behavior:'smooth',block:'start'});form.elements.text.focus();
  }
  else if(action==='reset-composer'){$('#queue-form').reset();$('#composer-note').textContent=t('Új piszkozatot mentünk. Időzítéshez külön jóváhagyást kérünk.');}
  else if(action==='upload-image'){
    const file=$('#queue-image').files[0], form=$('#queue-form');if(!file)throw new Error(t('Válassz ki egy képet.'));
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error(t('Legfeljebb 5 MB méretű PNG, JPEG vagy WebP kép tölthető fel.'));
    if(form.elements.kind.value==='dm')throw new Error(t('A DM-hez az X-en csatold a képet.'));
    const ids=form.elements.mediaIds.value.split(',').map(s=>s.trim()).filter(Boolean);if(ids.length>=4)throw new Error(t('Legfeljebb 4 kép csatolható.'));
    if(!confirm(t('Feltöltöd ezt a képet az X-fiókod médiatárába? Ez élő X API-művelet.')))return;
    $('#upload-status').textContent=t('Feltöltés folyamatban…');
    const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error(t('A képfájl nem olvasható.')));reader.readAsDataURL(file);});
    try{const result=await api('/api/media',{base64,mimeType:file.type});if(!result.mediaId)throw new Error(t('A feltöltés nem adott médiaazonosítót.'));form.elements.mediaIds.value=[...ids,result.mediaId].join(',');$('#upload-status').textContent=html`Feltöltve: ${file.name}`;toast(t('Kép csatolva a tervezethez.'));}catch(error){$('#upload-status').textContent=t('A feltöltés sikertelen. Válassz képet és próbáld újra.');throw error;}
  }
  else if(action==='studio-publish'){await publishNow({kind:'post',text:$('#studio-draft').value},'page');}
  else if(action==='studio-queue'){await addQueue($('#studio-draft').value);}
  else if(action==='studio-save'){const text=$('#studio-draft').value;if(!text.trim())throw new Error(t('A tervezet még üres.'));await collection('library',{title:t('Saját tervezet'),text});}
  else if(action==='load-material'){
    const item=state[el.dataset.collection].find(i=>String(i.id)===id),text=item.text||item.analysis||item.description||'';
    const fill=()=>{const input=$('#studio-draft');if(input){input.value=text;$('#studio-count').textContent=html`${text.length} karakter`;input.scrollIntoView({behavior:'smooth',block:'center'});input.focus();}};
    if(currentPage==='studio')fill();else{navigate('studio');setTimeout(fill,0);}
  }
  else if(['result-ai','result-queue','save-inspiration','save-lead'].includes(action)){
    const card=el.closest('[data-post]'), p=getPost(card.dataset.post), u=author(p), input=$('[data-reply]',card);
    if(action==='result-ai'){const text=await ai(t('Írj érdemi választ. Kapcsolódj a bejegyzéshez, ne reklámozz kéretlenül.'),{post:p,draft:input.value},'reply');if(text!=null)setDraftValue(input,text,originPage);}
    if(action==='result-queue')await addQueue(input.value,'reply',p.id,u.username||'');
    if(action==='save-inspiration')await collection('library',{title:u.username?'@'+u.username:t('Inspiráció'),text:p.text,postId:p.id});
    if(action==='save-lead'){if(!u.id&&!u.username)throw new Error(t('A szerző adatai nem érhetők el ehhez a találathoz.'));await collection('leads',{name:u.name,username:u.username,userId:u.id,status:'new',notes:p.text,postId:p.id});}
  }
  else if(action==='save-feed'){const form=$('#search-form'), v=formValues(form);if(!v.query?.trim())throw new Error(t('Előbb adj meg keresőkifejezést.'));await collection('feeds',{name:v.query,query:v.query,language:v.language,age:v.age,excludeReplies:!!v.excludeReplies,hideReplied:!!v.hideReplied});}
  else if(action==='load-feed'){const f=state.feeds.find(i=>String(i.id)===id), form=$('#search-form');for(const key of ['query','language','age'])form.elements[key].value=f[key]||'';for(const key of ['excludeReplies','hideReplied'])form.elements[key].checked=!!f[key];await performSearch(form);}
  else if(action==='delete-collection'){if(confirm(t('Törlöd a mentett elemet?')))await mutate('/api/collection',{collection:el.dataset.collection,deleteId:id});}
  else if(action==='analyze-ai'){const text=await ai(t('Elemezd a fiók bejegyzéseinek témáit, hangnemét, nyitómondat-típusait és beszélgetési mintáit. Csak a kapott adatból következtess; adj adaptálható ötleteket.'),{account:analyzed.account,posts:analyzed.posts},'analysis');if(text!=null){analyzed.analysis=text;render();}}
  else if(action==='save-analysis'){if(!analyzed?.analysis)throw new Error(t('Előbb készíts összefoglalót az elemzéshez.'));await collection('sessions',{name:analyzed.account?.username||t('Fiókelemzés'),analysis:analyzed.analysis,username:analyzed.account?.username});}
  else if(action==='lead-save'||action==='lead-dm'){const card=el.closest('[data-lead]'), lead=state.leads.find(l=>String(l.id)===card.dataset.lead);if(action==='lead-save')await collection('leads',{...lead,status:$('[data-lead-status]',card).value,notes:$('[data-lead-notes]',card).value});else{navigate('queue');setTimeout(()=>{const form=$('#queue-form');if(form){form.elements.kind.value='dm';form.elements.target.value=lead.username||lead.userId||'';form.elements.text.focus();}},0);}}
}
async function togglePause() { if(config.paused){if(confirm(t('Folytatod a jóváhagyott időzített küldéseket?')))await mutate('/api/settings',{paused:false},t('Automatizálás folytatva.'));}else await mutate('/api/stop',{},t('Időzített küldés szüneteltetve.')); }
async function performSearch(form) {
  const v=formValues(form);let query=v.query.trim();if(v.language)query+=` lang:${v.language}`;if(v.excludeReplies)query+=' -is:reply';
  const result=await api('/api/search',{query,age:v.age||undefined}), replied=new Set([...state.inbox.filter(i=>i.status==='replied').map(i=>String(i.post?.id||i.id)),...state.queue.filter(i=>i.kind==='reply'&&i.status==='sent').map(i=>String(i.targetId))]);
  searchResults={...result,query,posts:(result.posts||[]).filter(p=>!v.hideReplied||!replied.has(String(p.id)))};
  render();const f=$('#search-form');if(!f)return;for(const k of ['query','language','age'])f.elements[k].value=v[k]||'';for(const k of ['excludeReplies','hideReplied'])f.elements[k].checked=!!v[k];
}
async function handleSubmit(form, intent = 'save') {
  const v=formValues(form), originPage=currentPage, studioDraft=$('#studio-draft');
  if(form.getAttribute('id')==='search-form')await performSearch(form);
  else if(form.getAttribute('id')==='studio-form'){const product=state.products.find(p=>String(p.id)===v.product),text=await ai(v.prompt,{product,style:state.settings.style,library:state.library.slice(-15),posts:state.posts.slice(0,15)},v.mode);if(text!=null)setDraftValue(studioDraft,text,originPage,'studio|page|studio-draft');}
  else if(form.getAttribute('id')==='product-form')await collection('products',v,`form:${form.getAttribute('id')}`);
  else if(form.getAttribute('id')==='lead-form')await collection('leads',{...v,username:v.username.replace(/^@/,''),status:'new'},`form:${form.getAttribute('id')}`);
  else if(form.getAttribute('id')==='analyze-form'){analyzed=await api('/api/analyze',{username:v.username.replace(/^@/,'')});render();}
  else if(form.getAttribute('id')==='queue-form'){
    const scheduledAt=v.scheduledAt?new Date(v.scheduledAt).toISOString():null;
    if(intent==='publish'&&scheduledAt)throw new Error(t('Azonnali közzétételhez töröld az időzítést.'));
    if(scheduledAt&&v.kind==='dm')throw new Error(t('A DM kézi küldésű, ezért nem időzíthető.'));
    if(scheduledAt&&new Date(scheduledAt)<=new Date())throw new Error(t('Válassz jövőbeli időpontot.'));
    if(v.kind==='reply'&&!/^\d+$/.test(v.target.trim()))throw new Error(t('A válaszhoz számból álló X-bejegyzésazonosító szükséges.'));
    if(v.kind==='dm'&&!v.target.trim())throw new Error(t('Add meg a DM címzettjét.'));
    if(intent==='publish'){await publishNow({...(v.id?{id:v.id}:{}),kind:v.kind,text:v.text,targetId:v.kind==='reply'?v.target.trim():'',mediaIds:v.mediaIds.split(',').map(s=>s.trim()).filter(Boolean)},`form:${form.getAttribute('id')}`);return;}
    if(scheduledAt&&!confirm(html`Jóváhagyod az automatikus élő X-küldést ekkor: ${date(scheduledAt)}? A programnak futnia kell.`))return;
    await mutate('/api/queue',{item:{...(v.id?{id:v.id}:{}),kind:v.kind,text:v.text,targetId:v.kind==='reply'||/^\d+$/.test(v.target)?v.target.trim():'',username:v.kind==='dm'?v.target.replace(/^@/,''):'',status:scheduledAt?'scheduled':'draft',scheduledAt,mediaIds:v.mediaIds.split(',').map(s=>s.trim()).filter(Boolean)}},scheduledAt?t('Jóváhagyott időzítés elmentve.'):t('Piszkozat elmentve.'),`form:${form.getAttribute('id')}`);
  }
  else if(['x-settings-form','ai-settings-form','general-settings-form'].includes(form.getAttribute('id'))){
    if(form.getAttribute('id')==='general-settings-form'){for(const key of ['goal','dailyWriteLimit'])v[key]=Number(v[key]);}
    await mutate('/api/settings',v,t('Beállítások elmentve.'),`form:${form.getAttribute('id')}`);
  }
}
document.addEventListener('click',async e=>{
  if(state?.demo&&e.target.closest('a[href^="https://x.com"]')){e.preventDefault();toast(t('Ez szintetikus mintaadat. Saját X-hivatkozásokhoz lépj ki a demóból és csatlakoztasd a fiókodat.'));return;}
  const nav=e.target.closest('[data-nav]');if(nav){navigate(nav.dataset.nav);return;}
  const el=e.target.closest('[data-action]');if(!el||el.disabled)return;
  el.disabled=true;try{await handleAction(el);}catch(error){toast(error.message,true);}finally{if(el.isConnected)el.disabled=false;}
});
document.addEventListener('submit',async e=>{if(!e.target.matches('form'))return;e.preventDefault();const form=e.target,submit=e.submitter;if(submit)submit.disabled=true;try{await handleSubmit(form,submit?.value||'save');}catch(error){toast(error.message,true);}finally{if(submit?.isConnected)submit.disabled=false;}});
function filterFollowers(value) { const query=value.toLocaleLowerCase('hu');$$('.filterable').forEach(row=>{row.hidden=!row.dataset.filter.toLocaleLowerCase('hu').includes(query);}); }
document.addEventListener('input',e=>{if(e.target.id==='follower-filter')filterFollowers(e.target.value);if(e.target.id==='studio-draft')$('#studio-count').textContent=html`${e.target.value.length} karakter`;});
document.addEventListener('change',async e=>{if(e.target.id==='ui-language'){const selected=e.target.value;e.target.disabled=true;captureDrafts();try{await api('/api/settings',{language:selected});state.settings.language=selected;window.XautoI18n.setLanguage(selected);render();toast(t('Beállítások elmentve.'));}catch(error){e.target.value=window.XautoI18n.language;toast(error.message,true);}finally{if(e.target.isConnected)e.target.disabled=false;}return;}if(e.target.id==='post-sort'){sortBy=e.target.value;render();}});
window.addEventListener('hashchange',()=>{if(state){render();$('#main').focus({preventScroll:true});window.scrollTo(0,0);}});
$('#refresh').addEventListener('click',async()=>{try{await refresh();toast(t('Helyi adatok frissítve.'));}catch(error){toast(error.message,true);}});
$('#stop').addEventListener('click',async()=>{try{await togglePause();}catch(error){toast(error.message,true);}});
refresh().catch(error=>{$('#main').innerHTML=heading(t('A munkatér nem tölthető be'),t('Ellenőrizd, hogy a helyi kiszolgáló fut-e.'))+html`<div class="inline-error">${esc(errorText(error.message))}</div><button id="retry">Újrapróbálás</button>`;$('#retry').addEventListener('click',()=>location.reload());});
