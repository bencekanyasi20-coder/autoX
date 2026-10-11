import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const draftKey = vm.runInNewContext('(' + source.slice(source.indexOf('function draftKey('), source.indexOf('function captureDrafts(')) + ')');
test('Engage reply drafts have stable distinct cache keys', () => {
  const control = postId => ({ type: 'textarea', name: '', id: '',
    closest: selector => selector === '[data-post]' ? { dataset: { post: postId } } : null,
    hasAttribute: name => name === 'data-reply' });
  assert.equal(draftKey(control('123'), 'engage'), 'engage|post:123|reply');
  assert.notEqual(draftKey(control('123'), 'engage'), draftKey(control('456'), 'engage'));
  assert.equal(draftKey({ type: 'password', name: 'openaiKey' }, 'settings'), null);
});

function extract(start, end) { return source.slice(source.indexOf(start), source.indexOf(end)); }

test('X sync requires user cost confirmation before making a request', async () => {
  const calls=[];
  let approved=false;
  const run=vm.runInNewContext(extract('async function handleAction(', 'async function togglePause(')+';handleAction', {
    currentPage:'overview',t:value=>value,confirm:()=>approved,mutate:async(...args)=>calls.push(args)
  });
  await run({dataset:{action:'sync',kind:'posts'}});
  assert.equal(calls.length,0);
  approved=true;
  await run({dataset:{action:'sync',kind:'posts'}});
  assert.equal(calls.length,1);
  assert.equal(calls[0][0],'/api/sync');
  assert.equal(calls[0][1].confirmed,true);
});

test('optional metadata warnings are visible without claiming the sync failed', () => {
  const render=vm.runInNewContext(extract('function syncNotice(', 'function pageFromHash(')+';syncNotice', {
    t:value=>value,html:(parts,...values)=>String.raw({raw:parts},...values),errorText:value=>value,
    state:{sync:{posts:{status:'warning',warnings:['X returned posts, but some reply/repost references may be missing or incomplete.']}}},esc:String
  });
  const output=render();
  assert.match(output,/hivatkozott/);
  assert.doesNotMatch(output,/sikertelen/);
});

test('search completion tolerates navigation while request is pending', async () => {
  const run = vm.runInNewContext(extract('async function performSearch(', 'async function handleSubmit(') + ';performSearch', {
    formValues: () => ({query:'hello'}), api:async()=>({posts:[]}), state:{inbox:[],queue:[]},
    render:()=>{}, $:()=>null, Date, Set
  });
  await run({});
});

test('Engage date filter is sent separately rather than as a web search operator', async () => {
  let request;
  const run=vm.runInNewContext(extract('async function performSearch(', 'async function handleSubmit(')+';performSearch', {
    formValues:()=>({query:'builders',age:'3',language:'en'}),api:async(path,body)=>{request={path,body};return {posts:[]};},
    state:{inbox:[],queue:[]},render:()=>{},$:()=>null,Date,Set
  });
  await run({});
  assert.equal(request.body.query,'builders lang:en');
  assert.equal(request.body.age,'3');
});

test('mutation clears drafts for the page where saving started', async () => {
  let finish;
  const cleared=[];
  const context={api:()=>new Promise(resolve=>{finish=resolve;}),currentPage:'queue',
    clearDraftGroup:(...args)=>cleared.push(args),refresh:async()=>{},toast:()=>{}};
  vm.createContext(context);
  vm.runInContext(extract('async function mutate(', 'function navigate(')+';this.save=mutate',context);
  const pending=context.save('/api/queue',{},'', 'form:queue-form');
  context.currentPage='studio';finish({});await pending;
  assert.deepEqual(cleared, [['form:queue-form','queue']]);
});

test('completed AI draft remains cached after leaving its page', () => {
  const drafts=new Map();
  const set=vm.runInNewContext(extract('function setDraftValue(', 'function clearDraftGroup(')+';setDraftValue', {
    draftKey:()=> 'engage|post:1|reply',inputDrafts:drafts,currentPage:'overview'
  });
  set({},'generated reply','engage');
  assert.equal(drafts.get('engage|post:1|reply'),'generated reply');
});

test('persisted X credit failures are visible and escaped', () => {
  const render=vm.runInNewContext(extract('function syncNotice(', 'function pageFromHash(')+';syncNotice', {
    t:value=>value,html:(parts,...values)=>String.raw({raw:parts},...values),errorText:value=>value,state:{sync:{posts:{status:'error',error:'X HTTP 402 <unsafe>'}}},esc:value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;')
  });
  const html=render();
  assert.match(html,/402/);assert.match(html,/kredit/);assert.match(html,/&lt;unsafe&gt;/);assert.doesNotMatch(html,/<unsafe>/);
});


test('skip-to-content preserves the selected page', () => {
  const resolve=vm.runInNewContext(extract('function pageFromHash(', 'function render()')+';pageFromHash', {
    pages:[['overview'],['queue'],['studio']]
  });
  assert.equal(resolve('#main','queue'),'queue');
  assert.equal(resolve('#studio','queue'),'studio');
  assert.equal(resolve('#unknown','queue'),'overview');
});

test('restored follower filters continue hiding unrelated rows', () => {
  const rows=[{dataset:{filter:'Anna coder'}},{dataset:{filter:'Bela builder'}}];
  const filter=vm.runInNewContext(extract('function filterFollowers(', "document.addEventListener('input'")+';filterFollowers', {$$:()=>rows});
  filter('ANNA');
  assert.equal(rows[0].hidden,false);assert.equal(rows[1].hidden,true);
  filter('');assert.equal(rows[1].hidden,false);
});
