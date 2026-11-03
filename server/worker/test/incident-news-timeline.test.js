import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const filename=fileURLToPath(new URL('../../../game_runtime.js',import.meta.url));
const runtime=readFileSync(filename,'utf8');
const start=runtime.indexOf('function newsForIncident(c){');
const end=runtime.indexOf('function ensureGeneratedCases(){',start);
assert.ok(start>=0&&end>start,'real P3 lifecycle functions exist');

function run(){
 const c={id:'crime-a',week:22,kind:'criminal',tag:'형사·살인',name:'가상 사건 · 서울 흑정동 (2027.04.02)',
  who:['suspect','victim'],story:{investigator:{detective:'police'}}};
 const S={week:14,pendingCases:[{case:c,incidentWeek:14,investigationWeek:17,filingWeek:22,investigated:false}],
  generatedCases:[],cases:{}},CASES=[],NPC={suspect:{name:'가상 갑'},victim:{name:'가상 을'},police:{name:'담당 수사관'}};
 const newsItems=[],memories=[];
 const ctx={S,CASES,NPC,news:(...x)=>newsItems.push({week:S.week,args:x}),
  remember:(...x)=>memories.push(x),log:()=>{},ContinuityEngine:{snapshots:()=>[]}};
 vm.runInNewContext(runtime.slice(start,end)+';this.incident=newsForIncident;this.progress=progressPendingCases;',ctx,{filename});
 return {S,CASES,NPC,c,newsItems,memories,incident:ctx.incident,progress:ctx.progress};
}
test('incident crime headline appears before investigation and filing, without revealing suspect or truth',()=>{
 const w=run();
 w.incident(w.c);
 assert.match(w.newsItems[0].args[0],/흑정동 살인 사건 발생/);
 assert.ok(!w.newsItems[0].args.join(' ').includes('가상 갑'));
 assert.equal(w.newsItems[0].args[3].stage,'incident');
 w.S.week=16;w.progress();
 assert.equal(w.CASES.length,0);
 assert.equal(w.newsItems.length,1);
 w.S.week=17;w.progress();
 assert.equal(w.newsItems[1].args[3].stage,'investigation');
 assert.equal(w.CASES.length,0);
 w.S.week=22;w.progress();
 assert.equal(w.CASES[0].id,'crime-a');
 assert.equal(w.S.generatedCases[0],w.c);
 assert.equal(w.S.cases['crime-a'].verdict,null);
 assert.equal(w.newsItems[2].args[3].stage,'filed');
 assert.equal(w.S.pendingCases.length,0);
 assert.equal(w.CASES[0].who[0],'suspect');
});
test('resuming a saved pending case does not duplicate earlier articles or NPCs',()=>{
 const w=run();
 w.S.week=17;w.progress();
 const copy=JSON.parse(JSON.stringify(w.S));
 const S=copy,CASES=[],NPC=w.NPC,newsItems=[];
 const ctx={S,CASES,NPC,news:(...args)=>newsItems.push(args),remember:()=>{},log:()=>{},
  ContinuityEngine:{snapshots:()=>[]}};
 vm.runInNewContext(runtime.slice(start,end)+';this.progress=progressPendingCases;',ctx,{filename});
 S.week=18;ctx.progress();assert.equal(newsItems.length,0);
 S.week=22;ctx.progress();
 assert.equal(CASES.length,1);
 assert.equal(newsItems.length,1);
 ctx.progress();assert.equal(CASES.length,1);
 assert.equal(newsItems.length,1);
});
