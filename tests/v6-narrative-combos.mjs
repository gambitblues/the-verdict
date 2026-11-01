/* 60 written cases × 30 casts = 1,800 generated trials, checked for people that do not fit the story.
 * Run: node tests/v6-narrative-combos.mjs   (COMBOS=n to change the casts per case, SAMPLE_OUT=file.md for a 10% sample
 * of rendered cases for a human read-through)
 * Automatic checks per generated trial:
 *  - every role is filled by a distinct, living adult (the victim of a homicide may be dead)
 *  - a person is never both a party/lawyer and a witness in the same case
 *  - ages follow the PROFILE table (same-age pairs, the younger one younger) and witness ages stay adult
 *  - sex rules: opposite-sex parties where the story needs it, same-sex pairs where it says so, gendered roles match
 *  - sibling-style address ({A>B}) renders the right word for the two people's sexes
 *  - prosecutors and lawyers are lawyers; criminal cases have a prosecutor on side 0
 *  - nothing of the template leaks into the text the player reads */
import { chromium } from 'playwright';
import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.cwd(),COMBOS=Number(process.env.COMBOS||30);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(q,r)=>{const f=path.resolve(base,'.'+decodeURI(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!f.startsWith(base)){r.writeHead(403);return r.end()}try{const c=await readFile(f);r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(c)}catch{r.writeHead(404);r.end('')}});
await new Promise(o=>server.listen(0,'127.0.0.1',o));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>{try{localStorage.setItem('verdict_match_off','1')}catch{}});   // this test covers the scripted trial; match trials: tests/match-play.mjs
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await page.locator('#profile-continue').click();await page.locator('#playerName').fill('서사 검증');
 await page.locator('[data-action="start"]').last().click();
 await page.waitForFunction(()=>typeof S!=='undefined'&&S.legalWorld?.firstFour===true,{timeout:30000});
 await page.waitForFunction(()=>(S.casePacks||[]).some(p=>p.packId==='v6-new-30'),null,{timeout:10000});
 const out=await page.evaluate(COMBOS=>{
  window.save=()=>true; // thousands of throwaway trials: skip writing them to storage
  for(const c of S.generatedCases)S.cases[c.id].referred=true;
  const C=VerdictCurated,TP=VerdictTrialPlay,problems=[],sample=[];
  const isF=p=>/여/.test(p?.gender||''),age=p=>year()-p.bornYear;
  const KIN={'남남':'형','남여':'오빠','여남':'누나','여여':'언니'};
  const walk=(o,f,k='')=>{if(typeof o==='string')return f(o,k);if(Array.isArray(o))return o.forEach((v,i)=>walk(v,f,k+'['+i+']'));if(o&&typeof o==='object')for(const [kk,v] of Object.entries(o))walk(v,f,k+'.'+kk)};
  let trials=0;
  for(const id of C.ids){const cur=C.cases[id],cand=CasePackEngine.pool(S).find(x=>x.a.id===id);
   for(let n=0;n<COMBOS;n++){
    const c=createGeneratedCase(cand);if(!c){problems.push(id+': could not create');continue}
    S.cases[c.id]??={phase:0,actions:[],clues:[],flags:[],verdict:null};
    const t=TP.ensure(c,S.cases[c.id]);trials++;
    const tag=`${id}#${n}`,bad=m=>problems.push(tag+': '+m);
    const [a,b]=c.who.map(x=>NPC[x]),ws=t.witnesses.map(w=>NPC[w.id]),law=[NPC[c.side[0]],NPC[t.opponent]];
    const everyone=[...c.who,...t.witnesses.map(w=>w.id),c.side[0],t.opponent].filter(Boolean);
    if(new Set(everyone).size!==everyone.length)bad('one person holds two roles');
    for(const [p,role] of [[a,'A'],...ws.map((w,i)=>[w,'W'+(i+1)]),[law[0],'side0'],[law[1],'opponent']]){
     if(!p){bad('missing '+role);continue}
     if(p.alive===false)bad(role+' is dead');
     if(age(p)<18)bad(role+' is a minor ('+age(p)+')');
     if(age(p)>100)bad(role+' is over 100');
    }
    if(b&&age(b)<18)bad('B is a minor');
    if(c.kind==='criminal'&&!NPC[c.side[0]]?.legalCareer)bad('criminal case without a prosecutor');
    if(NPC[t.opponent]&&!NPC[t.opponent].legalCareer)bad('opposing counsel is not a lawyer');
    // ages per PROFILE
    const pr=cur.profile||{};
    for(const [k,p] of [['A',a],['B',b]]){const x=pr[k];if(!x||!p)continue;const g=age(p);
     if(x.same==='A'){if(g!==age(a))bad(k+' should be the same age as A')}
     else if(x.younger==='A'){if(!(g<age(a)))bad(k+' should be younger than A ('+g+' vs '+age(a)+')')}
     else if(g<x.age[0]||g>x.age[1])bad(`${k} age ${g} outside ${x.age}`)}
    // sex rules
    const sx=cur.sex||{};
    if(sx.AB==='diff'&&a&&b&&isF(a)===isF(b))bad('parties must be of opposite sex');
    if(sx.AB==='same'&&a&&b&&isF(a)!==isF(b))bad('parties must be of the same sex');
    if(sx.A&&a&&(sx.A==='여')!==isF(a))bad('A sex rule');
    for(const [i,r] of Object.entries(sx.W||{})){const w=ws[i],ref=r.endsWith('A')?a:b;if(!w||!ref)continue;if(r.startsWith('same')!==(isF(w)===isF(ref)))bad('witness '+i+' sex rule '+r)}
    cur.witnesses.forEach((w,i)=>{const p=ws[i],f=window.VerdictWitnessFloor?.(w.role,w.role+' '+w.story+' '+w.stake)||0;if(p&&f&&age(p)<f&&!t.witnesses[i].reused)bad(`witness "${w.role}" is ${age(p)}, younger than ${f} for that job or story`)});
    t.witnesses.forEach((w,i)=>{const p=ws[i];if(/할머니|어머니|딸|누나|언니|아내/.test(w.role)&&!isF(p))bad('female role "'+w.role+'" given to a man');
     if(/할아버지|아버지|아들|오빠|남편/.test(w.role)&&!/형제/.test(w.role)&&isF(p))bad('male role "'+w.role+'" given to a woman')});
    // rendered text: address words, leftovers
    const sexOf={A:a,B:b,...Object.fromEntries(ws.map((w,i)=>['W'+(i+1),w]))};
    walk(cur,(s,k)=>{
     for(const m of s.matchAll(/\{([A-Z]\d?)>([A-Z]\d?)(?:\|[가-힣]+)?\}/g)){const x=sexOf[m[1]],y=sexOf[m[2]];if(!x||!y)continue;
      const want=KIN[(isF(x)?'여':'남')+(isF(y)?'여':'남')],got=TP.tell(c,t,m[0]);if(!got.startsWith(want))bad(`address ${m[0]} → ${got}, expected ${want}`)}
     const filled=TP.tell(c,t,s);if(/\{[A-Z]|undefined|null|NaN/.test(filled))bad('template leak in '+k+': '+filled.slice(0,60));
    });
    if(n%10===0)sample.push({tag,title:c.name,A:`${a.name} (${a.gender}, ${age(a)}세, ${a.career})`,B:b?`${b.name} (${b.gender}, ${age(b)}세, ${b.career})`:'',
     W:ws.map((w,i)=>`${t.witnesses[i].role}: ${w.name} (${w.gender}, ${age(w)}세)`),summary:TP.tell(c,t,cur.summary)});
    S.cases[c.id].referred=true;
   }}
  return {trials,problems:[...new Set(problems)],sample};
 },COMBOS);
 if(process.env.SAMPLE_OUT)await writeFile(process.env.SAMPLE_OUT,out.sample.map(s=>`### ${s.tag} · ${s.title}\n- A ${s.A}\n- B ${s.B}\n${s.W.map(w=>'- '+w).join('\n')}\n\n${s.summary}\n`).join('\n'));
 if(out.problems.length)console.log(out.problems.slice(0,40).join('\n'));
 assert.equal(out.trials,60*COMBOS,'every case × cast generated');
 assert.equal(out.problems.length,0,out.problems.length+' narrative problems');
 assert.equal(errs.length,0,'page errors: '+errs.join('; '));
 console.log(`PASS: ${out.trials} generated trials (60 cases × ${COMBOS} casts) · roles, ages, sex rules, address words, template text · ${out.sample.length} sampled for human review`);
}finally{await browser.close();server.close()}
