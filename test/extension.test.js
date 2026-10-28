import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../extension/background.js',import.meta.url),'utf8');
function worker(){
  let activate;const calls=[];
  // Double at the browser API boundary: assert the real worker's routed effects.
  const chrome={action:{onClicked:{addListener:fn=>activate=fn},setBadgeText:async opts=>calls.push(['badge',opts])},
    tabs:{update:async(id,opts)=>calls.push(['navigate',id,opts])},
    scripting:{executeScript:async opts=>calls.push(['inject',opts])}};
  vm.runInNewContext(source,{chrome,URL,console});return {activate,calls};
}
test('o ícone não injeta código em outros sites nem em domínios parecidos',async()=>{
  for(const url of ['https://example.org','https://cadeflavio.run.example.org','http://cadeflavio.run']){
    const {activate,calls}=worker();await activate({id:4,url});
    assert.equal(calls.some(c=>c[0]==='inject'||c[0]==='navigate'),false);
  }
});
test('sem debug, habilita leitura na mesma página sem iniciar uma partida',async()=>{
  const {activate,calls}=worker();await activate({id:4,url:'https://cadeflavio.run/?foo=bar'});
  const nav=calls.find(c=>c[0]==='navigate');assert.equal(nav[1],4);
  const u=new URL(nav[2].url);assert.equal(u.searchParams.get('foo'),'bar');assert.equal(u.searchParams.has('debug'),true);
  assert.equal(calls.some(c=>c[0]==='inject'),false);
});
test('com debug, injeta o pacote apenas na aba explicitamente acionada',async()=>{
  const {activate,calls}=worker();await activate({id:4,url:'https://cadeflavio.run/?debug'});
  const inject=calls.find(c=>c[0]==='inject')[1];
  assert.equal(inject.target.tabId,4);assert.equal(inject.world,'MAIN');
  assert.deepEqual([...inject.files],['bot.js']);assert.equal(calls.some(c=>c[0]==='navigate'),false);
});
