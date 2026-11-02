/* Draft a world sheet from a curated case + a hand file. Usage: node world-sheets/tools/from-curated.cjs <id>  (reads world-sheets/hand/<id>.json, writes world-sheets/cases/<id>.json)
 * From the curated case: card, people A/B, witnesses (saw = what they say + their answers in that world), first-day records
 * (evidence excerpts, same in every world), ordered records (follow-up evidence, per world), knows (party answers).
 * From the hand file: everything the sheet needs that the curated case does not say: worlds' label/legal/act/motive/cause/
 * sentencing/timeline, common date/timeline/facts, places, devices, people overrides (age, job, traits, leans, sex),
 * record overrides and extra saw lines. Hand values win. */
const fs=require('fs'),path=require('path');
const repo=path.join(__dirname,'..','..'),scratch=path.join(__dirname,'..');
global.window={};eval(fs.readFileSync(repo+'/curated_cases.js','utf8'));
const C=window.VerdictCurated.cases;
const id=process.argv[2],c=C[id];if(!c)throw Error('no case '+id);
const hand=JSON.parse(fs.readFileSync(path.join(scratch,'hand',id+'.json'),'utf8'));
const T=['did','didnt','reason'];
const per=(v,t)=>v==null?null:typeof v==='string'?v:(v[t]??null);
const clean=s=>String(s||'').trim().replace(/\s+/g,' ');
const crim=!!c.charge&&!c.claim;
const arch=(()=>{for(const f of fs.readdirSync(path.join(repo,'content-packs')).filter(x=>x.endsWith('.json'))){try{const p=JSON.parse(fs.readFileSync(path.join(repo,'content-packs',f),'utf8'));const a=(p.archetypes||p.cases||[]).find(x=>x.id===id);if(a?.title)return a}catch{}}return {}})();
const CAT=[[/homicide/,'homicide'],[/sexual/,'sexual'],[/family|inherit/,'family'],[/financial|fraud/,'financial'],[/property|fire|rent/,'property'],[/reputation|defamation/,'reputation'],[/professional|medical/,'professional'],[/violence|stalking/,'violence'],[/public|bribe/,'public'],[/civil/,'civil']];
const cat=hand.category||arch.category||CAT.find(([re])=>re.test(id))?.[1]||'civil';
const card={kind:crim?'criminal':'civil',category:cat,title:hand.title||c.title||arch.title,summary:hand.summary||clean(c.summary),accused:crim?'A':'B',complainant:crim?'B':'A'};
if(crim)card.charge={life:false,fine:0,...c.charge};else card.claim=c.claim||{amount:0,fair:[0,0],what:c.decision?.what||''};
if(c.decision)card.decision={what:c.decision.what,yes:c.decision.yes,no:c.decision.no,...(hand.decision||{})};
if(card.claim&&!card.claim.fair)card.claim.fair=[0,card.claim.amount||0];
const pr=c.profile||{};
const party=k=>({key:k,name:`{${k}}`,role:k==='A'?(crim?'피고인':'원고'):(crim?'피해자':'피고'),age:pr[k]?.age?Math.round((pr[k].age[0]+pr[k].age[1])/2):40,job:pr[k]?.job||'—',edu:pr[k]?.deg||undefined,family:pr[k]?.mar||undefined,state:clean(c.people?.[k]),traits:k===card.accused?{composure:'보통',honesty:'보통',legalStance:'부인'}:{memoryAccuracy:'보통',confidence:'보통',honesty:'높음'}});
const W=(c.witnesses||[]).map((w,i)=>({key:'W'+(i+1),src:w}));
for(const f of c.followUps||[])if(f.witness)W.push({key:'W'+(W.length+1),src:f.witness,node:f});
const people=[party('A'),party('B'),...W.map(({key,src})=>({key,name:`{${key}}`,role:src.role,age:40,job:src.role,stake:clean(src.stake||src.interest||'없음'),leans:null,traits:{honesty:'보통',pressure:'보통',memoryAccuracy:'보통'}}))];
for(const p of people)Object.assign(p,hand.people?.[p.key]||{});
if(c.sex){if(c.sex.A&&!hand.people?.A?.sex)people[0].sex=c.sex.A;if(c.sex.B&&!hand.people?.B?.sex)people[1].sex=c.sex.B}
for(const p of people)for(const k of Object.keys(p))if(p[k]===undefined)delete p[k];
/* records */
const recs=[];
(c.evidence||[]).forEach((e,i)=>recs.push({id:'r-e'+(i+1),title:e.title,kind:e.kind||'자료',by:e.by==='피고'||e.by==='변호인'||e.side==='d'?(crim?'변호인':'피고'):(crim?'검찰':'원고'),how:clean(e.how||''),first:true,content:Object.fromEntries(T.map(t=>[t,clean(per(e.excerpt,t)||e.shows)]))}));
for(const f of c.followUps||[]){const e=f.evidence;if(!e)continue;
 const side=/피고|변호/.test(e.by||'')||f.to==='d'?(crim?'변호인':'피고'):(crim?'검찰':'원고');
 recs.push({id:'r-'+f.id,title:e.title,kind:e.kind||'자료',by:side,how:clean(e.how||''),first:false,unlock:hand.unlock?.['r-'+f.id]||clean(e.title)+' 제출 주문',
  content:Object.fromEntries(T.map(t=>[t,clean(per(e.excerpt,t)||per(f.none,t)||'회신: 해당 기록 없음')]))});}
if(c.late)recs.push({id:'r-late',title:c.late.title,kind:c.late.kind||'감정서',by:/피고|변호/.test(c.late.by||'')?(crim?'변호인':'피고'):(crim?'검찰':'원고'),how:clean(c.late.how||'재판 중 도착한 회신'),first:false,unlock:clean(c.late.title)+' 회신 주문',content:Object.fromEntries(T.map(t=>[t,clean(per(c.late.excerpt,t)||c.late.shows)]))});
for(const r of hand.records||[]){const i=recs.findIndex(x=>x.id===r.id);if(i>=0)recs[i]={...recs[i],...r,content:{...recs[i].content,...(r.content||{})}};else recs.push(r)}
const drop=new Set(hand.dropRecords||[]);
const R=recs.filter(r=>!drop.has(r.id));
/* saw */
const saw=t=>Object.fromEntries(W.map(({key,src})=>{
 const lines=[src.says,...(src.q||[]).map(q=>per(q.a,t))].filter(Boolean).map(clean);
 const extra=hand.saw?.[key]?.[t]??hand.saw?.[key]?.all;
 const set=hand.sawSet?.[key]?.[t];
 return [key,set||[...lines,...(extra?[extra]:[])].map(s=>/[.?!…]$/.test(s)?s:s+'.').join(' ')]}));
const knows=t=>{const pa=(c.party?.q||[]).map(q=>per(q.a,t)).filter(Boolean).map(clean);
 return {A:hand.knows?.[t]?.A||(card.accused==='A'?pa.join(' / '):'—'),B:hand.knows?.[t]?.B||(card.accused==='B'?pa.join(' / '):'—')}};
const worlds=Object.fromEntries(T.map(t=>{const h=hand.worlds[t];
 return [t,{label:{did:'실제로 했다',didnt:'실제로 하지 않았다',reason:'행위는 있었지만 사정이 다르다'}[t],...h,
  records:Object.fromEntries(R.map(r=>[r.id,r.content[t]])),saw:saw(t),knows:knows(t)}]}));
const sheet={format:'verdict-world-sheet/v1',id,status:'review',source:{type:'original',note:'기존 집필 사건을 세계 시트로 옮김. 이름은 게임이 정함.'},card,people,
 places:hand.places||[],devices:hand.devices||[],common:hand.common,records:R.map(({content,...r})=>r),worlds,traps:hand.traps||[],screen:{allow:['판결문 수준의 사실'],avoid:'감각적·선정적 묘사'},open:[]};
fs.writeFileSync(path.join(repo,'world-sheets','cases',id+'.json'),JSON.stringify(sheet,null,1)+'\n');
console.log('wrote',id,R.length,'records',W.length,'witnesses');
