import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createDemoState} from '../demo.mjs';
import {computeAnalytics} from '../analytics.mjs';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function app(language='en') {
  const context=vm.createContext({window:{},location:{origin:'http://localhost'},Intl,Date,console});
  for(const file of ['errors-i18n.js','i18n.js'])vm.runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8'),context);
  context.window.XautoI18n.setLanguage(language);
  vm.runInContext(source.slice(0,source.indexOf("document.addEventListener('click'")),context);
  return context;
}
function populated(context) {
  const state=createDemoState(Date.UTC(2026,9,11));
  function clean(value){if(!value||typeof value!=='object')return;for(const [key,item]of Object.entries(value)){if(typeof item==='string'&&['name','text','title','description','style','draft','notes','note','query','analysis','prompt'].includes(key))value[key]='User content';else clean(item);}}
  clean(state);context.fixture=state;context.metrics=computeAnalytics(state,28,Date.UTC(2026,9,11));
  vm.runInContext('state=fixture;analytics=metrics;config={};analyzed={account:state.account,posts:state.posts,users:state.users};searchResults={posts:state.posts.slice(0,1),users:state.users,query:"query"};',context);
  return state;
}
test('source templates preserve interpolated Hungarian content and markup identifiers',()=>{
  const c=app(),i18n=c.window.XautoI18n;
  assert.equal(i18n.translate('<div class="snapshot">nap</div>'),'<div class="snapshot">days</div>');
  assert.equal(i18n.html(['<p>Név: ','</p>'],'Név Áttekintés nap'),'<p>Name: Név Áttekintés nap</p>');
  i18n.setLanguage('hu');assert.equal(i18n.translate('Követők'),'Követők');
});
test('all eleven populated pages render English interface copy',()=>{
  const c=app();populated(c);
  for(const route of ['Overview','Analytics','Followers','Inbox','Engage','Studio','Queue','Patterns','Leads','Settings','Exports']){
    const markup=vm.runInContext('render'+route+'()',c);
    const text=markup.replace(/<[^>]+>/g,'');
    assert.doesNotMatch(text,/[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/,route+': '+text);
    assert.doesNotMatch(markup,/(?:placeholder|aria-label|title)=["'][^"']*[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/,route);
    assert.doesNotMatch(markup,/(?:placeholder|aria-label|title)=t\(/,route);
  }
});
test('English UI preserves Hungarian posts, saved searches, names, styles and drafts',()=>{
  const c=app(),s=populated(c),user='Követők nap Név <user>';
  s.feeds[0].name=user;for(const post of s.posts)post.text=user;c.metrics=computeAnalytics(s,28,Date.UTC(2026,9,11));vm.runInContext('analytics=metrics',c);s.account.name=user;s.settings.style=user;s.inbox[0].draft=user;s.queue[0].text=user;s.products[0].name=user;
  for(const route of ['Overview','Engage','Studio','Inbox','Queue','Settings']){
    assert.match(vm.runInContext('render'+route+'()',c),/Követők nap Név &lt;user&gt;/,route);
  }
});
test('formatters and status labels follow repeated language switches',()=>{
  const c=app();populated(c);
  assert.equal(vm.runInContext('fmt(1234.5)',c),'1,234.5');
  assert.match(vm.runInContext('renderQueue()',c),/>Draft<\/span>/);
  c.window.XautoI18n.setLanguage('hu');assert.match(vm.runInContext('renderQueue()',c),/>Piszkozat<\/span>/);
  c.window.XautoI18n.setLanguage('en');assert.match(vm.runInContext('renderQueue()',c),/>Draft<\/span>/);
});
