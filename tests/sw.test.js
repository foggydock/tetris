const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function worker({installFails=false,offline=false,status=200}={}) {
  const handlers={}, deleted=[];
  let skipped=false, added=[];
  const cached = new Response('cached');
  const cache = { addAll: async urls => { added=urls; if(installFails) throw Error('offline asset'); }, match: async () => cached, put: async () => {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../sw'), 'utf8'), {
    URL, Response,
    self:{ location:new URL('https://example.test/tetris/sw.js'),addEventListener:(key,fn)=>handlers[key]=fn,
      skipWaiting:()=>{skipped=true;},clients:{claim:async()=>{}} },
    caches:{open:async()=>cache,keys:async()=>['other-app-v1','tetris-v3','tetris-v4'],delete:async key=>deleted.push(key)},
    fetch:async()=>{if(offline) throw Error('offline'); return new Response('network',{status});}
  });
  return {handlers,deleted,get skipped(){return skipped;},get added(){return added;}};
}
test('必須ファイルの保存失敗時は新SWを有効化しない',async()=>{
  const w=worker({installFails:true}); let pending;
  w.handlers.install({waitUntil:p=>pending=p});
  await assert.rejects(pending,/offline asset/); assert.equal(w.skipped,false);
});
test('必須ファイルを一括保存し、他アプリのキャッシュは維持する',async()=>{
  const w=worker();let pending;
  w.handlers.install({waitUntil:p=>pending=p});await pending;
  assert.equal(w.added.length,6); assert.equal(w.skipped,true);
  w.handlers.activate({waitUntil:p=>pending=p});await pending;
  assert.deepEqual(w.deleted,['tetris-v3']);
});
for(const scenario of [{offline:true},{status:503}])test(`オフライン/サーバーエラー時は保存済み画面を返す ${JSON.stringify(scenario)}`,async()=>{
  const w=worker(scenario);let response;
  w.handlers.fetch({request:{method:'GET',url:'https://example.test/tetris/',mode:'navigate',headers:{get:()=>''}},respondWith:p=>response=p,waitUntil:()=>{}});
  assert.equal(await (await response).text(),'cached');
});
test('無関係なURLの画面でトップページキャッシュを上書きしない',()=>{
  const w=worker();let handled=false;
  w.handlers.fetch({request:{method:'GET',url:'https://example.test/tetris/missing',mode:'navigate'},respondWith:()=>handled=true});
  assert.equal(handled,false);
});
