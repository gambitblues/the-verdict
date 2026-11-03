/* v8.6.3: family ties the story states. Run: node tests/family-kin.mjs
 * Sibling parties share a surname and both parents; a sibling witness carries the same surname; a child party carries
 * the father's surname and is the parent's child in the family graph; the story's dead/living parent is respected.
 * Sheet witnesses get questions that fit who they are (no single generic set for everyone). */
import { chromium } from 'playwright';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(q,r)=>{const f=path.resolve(base,'.'+decodeURI(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!f.startsWith(base)){r.writeHead(403);return r.end()}try{const c=await readFile(f);r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(c)}catch{r.writeHead(404);r.end()}});
await new Promise(o=>server.listen(0,'127.0.0.1',o));
const browser=await chromium.launch({headless:true});const page=await browser.newPage();
const errs=[];page.on('pageerror',e=>errs.push(e.message));
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await page.locator('#profile-continue').click();await page.locator('#playerName').fill('가족 검수');
 await page.locator('[data-action="start"]').last().click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.legalWorld?.firstFour===true,{timeout:30000});await page.evaluate(()=>VerdictCurated.loadAll());
 const R=await page.evaluate(()=>{const sur=n=>VerdictNames.split(n)[0],out=[];
  // same rule as kinLabel in game_runtime.js (person k as seen from x)
  const kinLabel=(x,k)=>{const r=x.relationships?.[k]?.kind,o=NPC[k];if(!r||!o)return '가족';const f=/여/.test(o.gender||'');
   const view=o.familyAnchor===x.id?r:x.familyAnchor===k?({parent:'child',child:'parent'}[r]||r):(x.parentIds||[]).includes(k)?'parent':(o.parentIds||[]).includes(x.id)?'child':r;
   return {parent:f?'모친':'부친',child:f?'딸':'아들',sibling:f?'자매':'형제',spouse:'배우자'}[view]||'가족'};
  const make=aid=>{for(const g of S.generatedCases)S.cases[g.id].referred=true;const cand=CasePackEngine.pool(S).find(x=>x.a.id===aid);const c=createGeneratedCase(cand);S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};const t=VerdictTrialPlay.ensure(c,S.cases[c.id]);const [a,b]=c.who;FamilyEngine.ensure(S,NPC,b,year());FamilyEngine.ensure(S,NPC,a,year());return {c,t,a,b}};
  const kids=(id,kind)=>Object.entries(NPC[id].relationships||{}).filter(([,v])=>v.kind===kind).map(([k])=>k);
  for(let n=0;n<4;n++){
   const s=make('inherit-family-records'),A=NPC[s.a],B=NPC[s.b],W=s.t.witnesses.find(w=>w.role==='둘째');
   out.push({k:'inherit',same:sur(A.name)===sur(B.name),wit:W&&sur(NPC[W.id].name)===sur(A.name),parents:kids(s.a,'parent').sort().join()===kids(s.b,'parent').sort().join()&&kids(s.a,'parent').length===2,
    sib:kids(s.a,'sibling').includes(s.b),fatherDead:NPC['family-'+s.a+'-parent-0']?.alive===false,label:kinLabel(A,s.b)});
   const g=make('v6-family-guardian-signature');out.push({k:'guardian',same:sur(NPC[g.a].name)===sur(NPC[g.b].name),fatherAlive:NPC['family-'+g.a+'-parent-0']?.alive!==false});
   const h=make('beta-homicide-010'),HA=NPC[h.a],HB=NPC[h.b],male=!/여/.test(HB.gender||'');
   out.push({k:'child',fatherSur:!male||sur(HA.name)===sur(HB.name),parent:kids(h.a,'parent').includes(h.b),asChild:kinLabel(HB,h.a),asParent:kinLabel(HA,h.b),
    sibs:kids(h.a,'sibling').every(x=>sur(NPC[x].name)===sur(HA.name))});
  }
  out.push({k:'audit',errors:FamilyEngine.audit(S,NPC).errors.slice(0,3)});
  return out});
 for(const r of R.filter(x=>x.k==='inherit')){assert.ok(r.same,'siblings share a surname');assert.ok(r.wit,'the sibling witness has the family surname');assert.ok(r.parents,'siblings share both parents');assert.ok(r.sib,'linked as siblings');assert.ok(r.fatherDead,'the father in an inheritance story has died');assert.match(r.label,/형제|자매/)}
 for(const r of R.filter(x=>x.k==='guardian')){assert.ok(r.same);assert.ok(r.fatherAlive,'the father in the guardian story is alive')}
 for(const r of R.filter(x=>x.k==='child')){assert.ok(r.fatherSur,'a child carries the father\'s surname');assert.ok(r.parent,'the parent party is the child\'s parent');assert.match(r.asChild,/아들|딸/);assert.match(r.asParent,/부친|모친/);assert.ok(r.sibs,'siblings carry the same surname')}
 assert.deepEqual(R.find(x=>x.k==='audit').errors,[],'family graph stays reciprocal');
 const Q=await page.evaluate(()=>{const qs={};for(const id of VerdictCurated.ids){const c=VerdictCurated.cases[id];if(!VerdictMatchPlay.has({contentPack:{archetypeId:id}}))continue;for(const w of c.witnesses||[]){const q=w.q?.find(x=>x.id==='q1')?.q;if(q)qs[q]=(qs[q]||0)+1}}return qs});
 const total=Object.values(Q).reduce((a,b)=>a+b,0),generic=Q['그날 직접 보고 들은 것을 말해 주세요.']||0;
 assert.ok(Object.keys(Q).length>=8,'sheet witnesses get questions that fit their role');assert.ok(generic/Math.max(1,total)<0.15,'the generic question set is rare ('+generic+'/'+total+')');
 assert.deepEqual(errs,[]);
 console.log(`  ✓ family ties · siblings, sibling witness, child of a party · role questions: ${Object.keys(Q).length} openings, generic ${generic}/${total}`);
}finally{await browser.close();server.close()}
