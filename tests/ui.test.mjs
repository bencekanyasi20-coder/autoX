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

test('composer dispatch works when hidden id field shadows the form id property',async()=>{
  const calls=[];
  const run=vm.runInNewContext(extract('async function handleSubmit(', "document.addEventListener('click'")+';handleSubmit',{
    formValues:()=>({id:'',kind:'post',text:'Fixture',target:'',scheduledAt:'',mediaIds:''}),
    currentPage:'queue',$:()=>null,t:x=>x,publishNow:async(...args)=>calls.push(args)
  });
  const form={id:{value:''},getAttribute:name=>name==='id'?'queue-form':null};
  await run(form,'publish');
  assert.equal(calls.length,1);
  assert.equal(calls[0][0].text,'Fixture');
  assert.equal(calls[0][1],'form:queue-form');
});

function publishFixture(overrides={}) {
  const calls=[];
  const context={state:{account:{username:'fixture'}},config:{xConnected:true,paused:false},currentPage:'studio',
    captureDrafts:()=>{},inputDrafts:new Map(),
    t:x=>x,confirm:()=>true,api:async(path,body)=>{calls.push({path,body});return{id:'saved-draft'};},
    mutate:async(path,body)=>{calls.push({path,body});},clearDraftGroup:(...args)=>calls.push({clear:args}),
    refresh:async()=>{},navigate:page=>calls.push({navigate:page}),...overrides};
  const run=vm.runInNewContext(extract('let publishingNow =', 'async function addQueue(')+';publishNow',context);
  return{run,calls};
}

test('publish now creates a tracked draft and sends the returned ID exactly once',async()=>{
  const {run,calls}=publishFixture();
  await run({kind:'post',text:'Fixture text',mediaIds:['123']},'page');
  assert.equal(calls[0].path,'/api/queue');
  assert.equal(calls[0].body.item.status,'draft');
  assert.equal(calls[0].body.item.scheduledAt,null);
  assert.equal(calls[0].body.item.mediaIds[0],'123');
  assert.deepEqual(Array.from(calls[1].clear),['page','studio']);
  assert.equal(calls[2].path,'/api/queue/action');
  assert.equal(calls[2].body.id,'saved-draft');
  assert.equal(calls[2].body.action,'send');
  assert.equal(calls[3].navigate,'queue');
});

test('publish now cancellation and blocked states make no API requests',async()=>{
  const cancelled=publishFixture({confirm:()=>false});
  await cancelled.run({kind:'post',text:'Fixture'},'page');
  assert.equal(cancelled.calls.length,0);
  for(const overrides of [{config:{paused:true,xConnected:true}},{state:{demo:true}},{config:{xConnected:false}}]){
    const f=publishFixture(overrides);
    await assert.rejects(f.run({kind:'post',text:'Fixture'},'page'));
    assert.equal(f.calls.length,0);
  }
  const dm=publishFixture();await assert.rejects(dm.run({kind:'dm',text:'Fixture'},'page'));assert.equal(dm.calls.length,0);
});

test('publish now suppresses double clicks and retains uncertain outcome in the queue without retry',async()=>{
  let release,calls=0;
  const f=publishFixture({mutate:()=>{calls++;return new Promise((resolve,reject)=>{release=()=>reject(new Error('Uncertain'));});}});
  const first=f.run({kind:'post',text:'Fixture'},'page');
  await Promise.resolve();
  await f.run({kind:'post',text:'Fixture'},'page');
  release();await assert.rejects(first,/Uncertain/);
  assert.equal(calls,1);
  assert.equal(f.calls.filter(c=>c.path==='/api/queue').length,1);
  assert.equal(f.calls.at(-1).navigate,'queue');
});

test('publish now preserves new edits typed while the draft save is pending',async()=>{
  const drafts=new Map([['studio|page|studio-draft','Submitted text']]);
  let complete;
  const f=publishFixture({inputDrafts:drafts,api:()=>new Promise(resolve=>{complete=()=>resolve({id:'saved'});})});
  const pending=f.run({kind:'post',text:'Submitted text'},'page');
  drafts.set('studio|page|studio-draft','My next idea');
  complete();await pending;
  assert.equal(drafts.get('studio|page|studio-draft'),'My next idea');
  assert.equal(f.calls.some(c=>c.clear),false);
});

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
