/* Save storage: plain JSON stays plain, a large save is compressed and reads back exactly,
 * and the stored text never holds control characters. Run: node tests/save-store.test.cjs */
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),vm=require('vm');
const store={};
const ctx={addEventListener(){},setTimeout,clearTimeout,TextEncoder,TextDecoder,
 localStorage:{setItem(k,v){store[k]=String(v)},getItem(k){return k in store?store[k]:null}}};
ctx.self=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','save_store.js'),'utf8')+';self.VS=VerdictStore',ctx);
const VS=ctx.VS;

const small={version:5,name:'판사',cases:{},market:{},journal:[]};
VS.save('k',()=>JSON.stringify(small));
assert.equal(store.k,JSON.stringify(small),'small saves stay plain JSON');
assert.equal(JSON.stringify(VS.read('k')),JSON.stringify(small));

const people={};for(let i=0;i<9000;i++)people['person_'+i]={name:'김지훈'+i,role:i%3?'참고인':'변호사',financialHistory:[{year:2030+i%9,reason:'연도별 재산 상태 기록'}],story:'오랫동안 같은 동네에서 가게를 했다. '+i};
const big={version:5,cases:{},market:{},journal:[],npcDB:people};
const json=JSON.stringify(big);
assert.ok(json.length>1200000,'fixture must be large');
VS.save('k',()=>json);
VS.flush();
assert.ok(store.k.startsWith('Z1:'),'large saves are compressed');
assert.ok(store.k.length<json.length/4,'compression pays off');
assert.ok(!/[\u0000-ÿ]/.test(store.k.slice(3)),'no control or latin-1 characters in the stored text');
assert.equal(VS.decode(store.k),json,'round trip is exact');
assert.equal(VS.read('missing'),null);
console.log(`save store tests passed · ${json.length} → ${store.k.length} characters`);
