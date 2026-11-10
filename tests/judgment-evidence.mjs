/* 판결문 '인정 사실'의 증거 문장: 무슨 자료인지(누가 언제 낸 어떤 자료), 그리고 그 자료에 실제로 무엇이 담겼는지.
 * Run: node tests/judgment-evidence.mjs
 * - sheet cases (adv-cr-030 출입구 CCTV): "X는 검찰이 처음부터 낸 영상이다. 여기에는 "…"라는 장면이 찍혀 있다."
 *   — never the placeholder "영상 — 법정에 처음 나온 자료"
 * - an exhibit received by a judge's order says so; written cases keep their own wording plus where it came from
 * - the news line reads the record too (no placeholder) */
import { chromium } from 'playwright';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(q,r)=>{const f=path.resolve(base,'.'+decodeURI(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!f.startsWith(base)){r.writeHead(403);return r.end()}try{const c=await readFile(f);r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(c)}catch{r.writeHead(404);r.end('')}});
await new Promise(o=>server.listen(0,'127.0.0.1',o));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await page.locator('#profile-continue').click();await page.locator('#playerName').fill('판결문 판사');await page.locator('[data-action="start"]').last().click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.legalWorld?.firstFour===true,{timeout:30000});await page.evaluate(()=>VerdictCurated.loadAll());
 const R=await page.evaluate(()=>{const TP=VerdictTrialPlay,out={};
  const mk=id=>{const cand=CasePackEngine.pool(S).find(x=>x.a.id===id);const c=createGeneratedCase(cand);S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};const st=S.cases[c.id],t=TP.ensure(c,st);t.evidence.forEach(e=>e.decision='use');return {c,t}};
  {const {c,t}=mk('adv-cr-030');out.sheet=TP.citables(c,t).filter(i=>i.kind==='evidence').map(i=>TP.evLine(i));
   /* an exhibit received by order (as followEvidence stores it), and one saved before v11.0.1 without 'says' */
   const f=(VerdictTrialPlay.curOf(c).followUps||[]).find(x=>x.type==='records'&&x.evidence);
   t.courtOrders=[{follow:f.id,type:'records',to:f.to,due:2}];const E=f.evidence,pk=x=>x&&typeof x==='object'&&!Array.isArray(x)?(x[t.truth]??x.reason):x;
   t.evidence.push({id:'e'+t.evidence.length,title:TP.tell(c,t,E.title),decision:'use',follow:f.id,arrivedDay:2,ordered:true,detail:{kind:E.kind,by:E.by,excerpt:TP.tell(c,t,pk(E.excerpt)),shows:TP.tell(c,t,pk(E.shows)),says:TP.tell(c,t,pk(E.says))}});
   t.evidence.push({id:'e'+t.evidence.length,title:'옛 세이브 자료',decision:'use',follow:f.id,arrivedDay:2,ordered:true,detail:{kind:E.kind,by:E.by,excerpt:TP.tell(c,t,pk(E.excerpt)),shows:TP.tell(c,t,pk(E.shows))}});
   out.ordered=TP.citables(c,t).filter(i=>i.kind==='evidence'&&/주문에 따라/.test(i.from||'')).map(i=>TP.evLine(i));
   out.news=JSON.stringify(window.VerdictWorld?.facts?.(c)||'')}
  {const id=Object.keys(VerdictCurated.cases).find(k=>!/^adv|^link/.test(k));const {c,t}=mk(id);out.written=TP.citables(c,t).filter(i=>i.kind==='evidence').map(i=>TP.evLine(i))}
  return out});
 assert.ok(R.sheet.length>=2,'sheet exhibits: '+R.sheet.length);
 for(const l of [...R.sheet,...R.ordered,...R.written])assert.ok(!/법정에 처음 나온 자료|주문으로 받은 자료|원문 확인 필요|\{[A-Z]/.test(l),'no placeholder or raw token: '+l);
 const cctv=R.sheet.find(l=>l.startsWith('출입구 CCTV'));assert.ok(cctv,'the CCTV line: '+R.sheet.join(' | '));
 assert.match(cctv,/검찰이 처음부터 낸 영상이다\. 여기에는 "00:55:30 .+"(이)?라는 장면이 찍혀 있다\.$/,cctv);
 assert.ok(R.sheet.some(l=>/진료 기록이다\. 여기에는 ".+"(이)?라는 내용이 적혀 있다\./.test(l)),'a medical record says what is written');
 assert.equal(R.ordered.length,2,'two ordered exhibits');assert.match(R.ordered[1],/옛 세이브 자료.+여기에는 ".+"(이)?라는 내용이 담겨 있다\./,R.ordered[1]);
 assert.match(R.ordered[0],/재판장의 .+ 주문에 따라 (검찰|변호인)이 \d+회 공판에 낸 .+(이다|다)\. 여기에는 ".+"(이)?라는/,R.ordered[0]);
 assert.ok(R.written.every(l=>/에 따르면 .+\(.+(처음부터|추가로|주문에 따라).+\)\.$/.test(l)),'written cases: own wording + where it came from: '+R.written[0]);
 for(const l of [...R.sheet,...R.ordered])assert.ok(!/[음함됨임]"라는/.test(l),'이라는 after a final consonant: '+l);
 assert.deepEqual(errs,[],errs.join('; '));
 console.log('  e.g. '+cctv);if(R.ordered[0])console.log('  e.g. '+R.ordered[0]);console.log('  e.g. '+R.written[0]);
 console.log('PASS: judgment exhibits say what each one is and what it records');
}finally{await browser.close();server.close()}
