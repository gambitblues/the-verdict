/* Narrative QA for the curated cases. Run: node tests/narrative-qa.cjs
 * Fills every text with several name sets (names with and without a final consonant) and checks:
 *  - no leftover placeholders or template seams ("이(가)", "혐의 혐의", "다 관련하여" …)
 *  - only known placeholders are used, and every particle is written as {X|particle}
 *  - structure: 3 evidence, 3 witnesses, 4 acts, both endings for the case kind, 3 truths
 *  - witness lines and answers are first-person without a final period; story sentences end with a period
 *  - no gender-assuming words outside roles that are gendered by definition
 *  - duplicated long sentences across all cases stay under 3%
 */
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
global.window={};
eval(fs.readFileSync(path.join(__dirname,'..','curated_cases.js'),'utf8'));
const C=window.VerdictCurated;
const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'..','content-packs','beta-weekend-100-v1.json'),'utf8'));
const pack6=JSON.parse(fs.readFileSync(path.join(__dirname,'..','content-packs','v6-new-30-v1.json'),'utf8'));
const kindOf=Object.fromEntries([...pack.archetypes,...pack6.archetypes].map(a=>[a.id,a.kind]));

const NAME_SETS=[
 {A:'박준',B:'김하늘',L:'정민석',W1:'오수빈',W2:'이강',W3:'최유리'},
 {A:'이현서',B:'장서진',L:'한도윤',W1:'서지안',W2:'윤재희',W3:'권율'}
];
const SEAMS=[/\{[A-Za-z]/,/이\(가\)|을\(를\)|은\(는\)|과\(와\)|\(으\)로/,/혐의 혐의/,/다 관련하여/,/\s{2,}/,/\.\./,/ \./,/,,/,/의 의 /];
const GENDERED=/남자|여자|남성|여성|아빠|엄마|남편|아내|장남|장녀|누나|오빠|언니|사위|며느리/;
const problems=[];
const texts=[];

function walk(c,key,value,names){
 if(value==null)return;
 if(Array.isArray(value)){value.forEach((v,i)=>walk(c,key+'['+i+']',v,names));return}
 if(typeof value==='object'){for(const [k,v] of Object.entries(value))walk(c,key+'.'+k,v,names);return}
 if(typeof value!=='string'||key.endsWith('.flaw'))return;
 for(const m of value.matchAll(/\{([^}]*)\}/g)){
  const [kk,p]=m[1].split('|'),[k,by]=kk.split('>');
  if(by!=null&&!/^(A|B|L|W[123])$/.test(by))problems.push(`${c.id} ${key}: unknown speaker in {${m[1]}}`);
  if(!/^(A|B|L|W[123])$/.test(k))problems.push(`${c.id} ${key}: unknown placeholder {${m[1]}}`);
  if(p&&!/^[가-힣]+$/.test(p))problems.push(`${c.id} ${key}: bad particle {${m[1]}}`);
 }
 if(/\{[A-Z]\d?\}(을|를|이|가|은|는|과|와|으로|로)(?=[\s,.'"])/.test(value))problems.push(`${c.id} ${key}: particle written outside {X|particle}`);
 const filled=C.fill(value,names);
 for(const re of SEAMS)if(re.test(filled))problems.push(`${c.id} ${key}: seam ${re} → ${filled.slice(0,80)}`);
 // the particle right after each name must match that name's final consonant
 for(const n of Object.values(names)){
  const has=C.particle(n,'이')===n+'이';
  for(const m of filled.matchAll(new RegExp(n+'(이|가|은|는|을|를|과|와)(?![가-힣])','g'))){
   const p=m[1],wantsFinal=['이','은','을','과'].includes(p);
   if(wantsFinal!==has)problems.push(`${c.id} ${key}: wrong particle "${n}${p}"`);
  }
 }
 if(GENDERED.test(filled)&&!key.includes('role'))problems.push(`${c.id} ${key}: gender-assuming word → ${filled.match(GENDERED)[0]}`);
 if(/(\.says|\.a(\.\w+)?|\.lead)$/.test(key)&&/[.。]$/.test(value))problems.push(`${c.id} ${key}: witness line should not end with a period`);
 if(/(summary|\.text|endings\.\w+|truth\.\w+|people\.[AB]|\.story)$/.test(key)&&!/[.!?"]$/.test(value.trim()))problems.push(`${c.id} ${key}: sentence does not end properly`);
 if(names===NAME_SETS[0])texts.push(...C.fill(value,{A:'갑',B:'을',L:'병',W1:'정',W2:'무',W3:'기'}).split(/(?<=[.?!])\s+/).filter(t=>t.length>=25));
}

for(const id of C.ids){
 const c=C.cases[id];
 assert.ok(kindOf[id],'unknown archetype '+id);
 const crim=kindOf[id]==='criminal';
 if(c.evidence.length!==3)problems.push(id+': needs 3 evidence');
 if(c.witnesses.length!==3)problems.push(id+': needs 3 witnesses');
 if(c.acts.length!==4)problems.push(id+': needs 4 acts');
 for(const k of crim?['convict','acquit']:['claimant','respondent'])if(!c.endings?.[k])problems.push(id+': missing ending '+k);
 for(const k of ['did','didnt','reason'])if(!c.truth?.[k])problems.push(id+': missing truth '+k);
 if(c.claims?.length!==2)problems.push(id+': needs two claims');
 // courtroom detail
 const iss=new Set((c.issues||[]).map(x=>x.id));
 if(iss.size<2||iss.size>3)problems.push(id+': needs 2-3 issues');
 if(crim){if(!c.charge||!(c.charge.max>=c.charge.min))problems.push(id+': criminal case needs a charge range');
  const dy=typeof c.demand==='number'?c.demand:null;if(dy==null&&!c.demand?.fine)problems.push(id+': needs a demand');
  if(dy!=null&&(dy<Math.max(c.charge.min,0.5)||dy>c.charge.max))problems.push(id+': demand outside the legal range');
  if(c.demand?.fine&&!(c.charge.fine>=c.demand.fine))problems.push(id+': fine demand but no fine in law');}
 else if(c.decision){for(const k of ['yes','no','yesNote','noNote','yesOrder','noOrder','what'])if(!c.decision[k])problems.push(id+': decision needs '+k);if(c.claim)problems.push(id+': decision case should not have a claim')}
 else if(!c.claim||!(c.claim.fair[1]<=c.claim.amount))problems.push(id+': civil case needs a claim');
 c.evidence.forEach((e,i)=>{for(const k of ['kind','by','when','excerpt','how','issue','side','check'])if(!e[k])problems.push(`${id} evidence[${i}]: missing ${k}`);if(e.issue&&!iss.has(e.issue))problems.push(`${id} evidence[${i}]: unknown issue`)});
 let variants=0;
 c.witnesses.forEach((w,i)=>{if(!w.lead)problems.push(`${id} witness[${i}]: missing lead`);
  const qs=w.q||[],ids=new Set(qs.map(q=>q.id));if(qs.length<3||qs.filter(q=>!q.hidden).length<2)problems.push(`${id} witness[${i}]: needs 3 questions, 2 open`);
  for(const q of qs){if(!iss.has(q.issue))problems.push(`${id} witness[${i}] ${q.id}: unknown issue`);
   if(typeof q.a==='object'){variants++;for(const k of ['did','didnt','reason'])if(!q.a[k])problems.push(`${id} witness[${i}] ${q.id}: missing answer ${k}`)}else if(!['p','d','n'].includes(q.side))problems.push(`${id} witness[${i}] ${q.id}: needs side`);
   for(const n of q.next||[])if(!ids.has(n))problems.push(`${id} witness[${i}] ${q.id}: next ${n} missing`);
   if(q.hidden&&!qs.some(o=>(o.next||[]).includes(q.id)))problems.push(`${id} witness[${i}] ${q.id}: hidden question never opens`)}});
 if(variants<2)problems.push(id+': needs at least two truth-dependent answers');
 if(!c.late||!c.late.title||!c.late.rebut||!iss.has(c.late.issue))problems.push(id+': late evidence incomplete');
 // judge's orders (followUps): valid issue / type / target / trigger, complete evidence, witness, recall or explanation
 const fids=new Set(),FU=c.followUps||[],allIds=new Set(FU.map(f=>f.id)),dec=!!c.decision;
 const qExists=(w,q)=>{const W=c.witnesses[w];return !!W&&(!q||(W.q||[]).some(x=>x.id===q))};
 const refs=a=>!a?[]:a.any||a.all?(a.any||a.all).flatMap(refs):[a];
 for(const f of FU){const at=`${id} followUp ${f.id}`;if(fids.has(f.id))problems.push(at+': duplicate id');fids.add(f.id);
  if(!iss.has(f.issue))problems.push(at+': unknown issue');if(!['records','original','alibi','expert','witness','recall','explain','compare'].includes(f.type))problems.push(at+': bad type');
  if(!['p','d','both'].includes(f.to))problems.push(at+': bad target');if(!f.ask)problems.push(at+': needs the order text');
  if(!!f.now!==dec)problems.push(at+': on-the-spot questions belong to decision cases only, and decision cases only have those');
  if(f.day!=null&&!(f.day>=1&&f.day<=4))problems.push(at+': day must be 1-4');
  for(const r of refs(f.after)){
   if(r.heard!=null){const [w,q]=String(r.heard).split(':');if(!qExists(Number(w),q))problems.push(at+': trigger heard '+r.heard+' does not exist')}
   else if(r.got||r.miss||r.done){const n=r.got||r.miss||r.done;if(!allIds.has(n)||n===f.id)problems.push(at+': trigger refers to unknown node '+n);else if(FU.findIndex(x=>x.id===n)>FU.indexOf(f))problems.push(at+': trigger refers to a later node '+n)}
   else if(r.contra){if(!iss.has(r.contra))problems.push(at+': contra on unknown issue')}
   else problems.push(at+': unknown trigger '+JSON.stringify(r))}
  if(f.to==='d'&&crim&&f.evidence&&!f.none)problems.push(at+': a defence order in a criminal case needs a "none" answer (no burden of proof)');
  if(f.evidence){const E=f.evidence;for(const k of ['title','kind','by','when','excerpt','shows','caveat','how','check'])if(!E[k])problems.push(at+': evidence needs '+k);
   if(!E.side&&typeof E.excerpt!=='object')problems.push(at+': evidence needs side');
   for(const k of ['excerpt','shows','side','part'])if(E[k]&&typeof E[k]==='object'){for(const tr of ['did','didnt','reason'])if(E[k][tr]==null)problems.push(at+': evidence '+k+' needs '+tr)}
   if(typeof E.side==='object'&&Object.values(E.side).some(v=>!['p','d','n'].includes(v)))problems.push(at+': evidence side must be p/d/n')}
  const checkQ=(qs,where)=>{for(const q of qs){if(!iss.has(q.issue))problems.push(at+': '+where+' question with unknown issue');if(!q.q||!q.a)problems.push(at+': '+where+' question incomplete');
   if(typeof q.a==='object'){for(const k of ['did','didnt','reason'])if(!q.a[k])problems.push(at+': '+where+' '+q.id+' missing answer '+k)}else if(!['p','d','n'].includes(q.side))problems.push(at+': '+where+' '+q.id+' needs side')}};
  if(f.witness){const qs=f.witness.q||[];if(qs.length<3)problems.push(at+': witness needs 3 questions');if(!f.witness.role||!f.witness.story||!f.witness.lead)problems.push(at+': witness needs role, story, lead');checkQ(qs,'witness')}
  if(f.type==='recall'){if(!f.recall||!c.witnesses[f.recall.w])problems.push(at+': recall needs one of the written witnesses');else{const qs=f.recall.q||[];if(qs.length<2)problems.push(at+': recall needs 2+ new questions');checkQ(qs,'recall');if(!qs.some(q=>typeof q.a==='object'))problems.push(at+': recall needs a truth-dependent answer')}}
  if(f.type==='explain'&&!(f.answer?.p&&f.answer?.d))problems.push(at+': explanation needs what both sides say');
  if(!f.evidence&&!f.witness&&f.type!=='explain'&&f.type!=='recall')problems.push(at+': nothing can come back');
  const canBeEmpty=(f.have&&Object.values(f.have).includes(false))||(f.to==='d'&&crim&&(f.evidence||f.type==='records'||f.type==='alibi'));
  if(f.have&&Object.values(f.have).includes(false)&&!f.none)problems.push(at+': material may not exist, so a "none" answer is needed');
  if(canBeEmpty&&!FU.some(g=>refs(g.after).some(r=>r.miss===f.id)))problems.push(at+': when this comes back empty or refused, another node must offer a way forward (after:{miss})')}
 if(dec){if(FU.length<2)problems.push(id+': a decision case needs 2+ on-the-spot questions')}
 else{const need=/homicide|sexual|murder/.test(id)?6:5;if(FU.length<need)problems.push(`${id}: needs ${need}+ follow-up nodes (has ${FU.length})`);
  if(!FU.some(f=>(f.day||1)>=3||refs(f.after).some(r=>r.got||r.miss||r.done)))problems.push(id+': needs a node for the third hearing or later');
  if(!FU.some(f=>f.type==='recall'))problems.push(id+': needs new questions for a written witness (recall)');
  if(!FU.some(f=>f.type==='explain'))problems.push(id+': needs a case-specific clarification (explain)')}
 // questioning a party (v6.9): who, role, three questions with an answer for each truth
 {const P=c.party;if(!P)problems.push(id+': needs party questions');else{
  if(!['A','B'].includes(P.who)||!P.role)problems.push(id+': party needs who (A/B) and role');
  if(crim&&P.role!=='피고인')problems.push(id+': in a criminal case the accused is questioned');
  if((P.q||[]).length<3)problems.push(id+': party needs 3 questions');
  for(const q of P.q||[]){if(!iss.has(q.issue))problems.push(id+' party '+q.id+': unknown issue');if(!q.q)problems.push(id+' party '+q.id+': no question');
   for(const k of ['did','didnt','reason'])if(!q.a?.[k])problems.push(id+' party '+q.id+': missing answer '+k);
   if(q.side)for(const k of ['did','didnt','reason'])if(!['p','d','m','n'].includes(q.side[k]))problems.push(id+' party '+q.id+': bad side '+k)}}}
 if(!c.rebut||!c.closing)problems.push(id+': needs rebuttal and closing');
 for(const names of NAME_SETS)walk(c,'',c,names);
}
const counts={};for(const t of texts)counts[t]=(counts[t]||0)+1;
const dup=Object.values(counts).filter(n=>n>1).reduce((a,n)=>a+n,0)/Math.max(1,texts.length);

const unique=[...new Set(problems)];
if(unique.length){console.log(unique.join('\n'));}
console.log(`curated cases ${C.ids.length} · sentences ${texts.length} · duplicated ${(dup*100).toFixed(1)}% · problems ${unique.length}`);
assert.equal(C.ids.length,60,'expected 60 curated cases');
for(const a of pack6.archetypes)assert.ok(C.cases[a.id],'archetype without a curated case: '+a.id);
for(const id of C.ids)assert.ok(C.cases[id].profile,'no PROFILE for '+id);
assert.ok(dup<0.03,'too many repeated sentences');
assert.equal(unique.length,0,'narrative problems found');
console.log('narrative QA passed');
