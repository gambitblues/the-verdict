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
const kindOf=Object.fromEntries(pack.archetypes.map(a=>[a.id,a.kind]));

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
  const [k,p]=m[1].split('|');
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
 if(!c.rebut||!c.closing)problems.push(id+': needs rebuttal and closing');
 for(const names of NAME_SETS)walk(c,'',c,names);
}
const counts={};for(const t of texts)counts[t]=(counts[t]||0)+1;
const dup=Object.values(counts).filter(n=>n>1).reduce((a,n)=>a+n,0)/Math.max(1,texts.length);

const unique=[...new Set(problems)];
if(unique.length){console.log(unique.join('\n'));}
console.log(`curated cases ${C.ids.length} · sentences ${texts.length} · duplicated ${(dup*100).toFixed(1)}% · problems ${unique.length}`);
assert.equal(C.ids.length,30,'expected 30 curated cases');
assert.ok(dup<0.03,'too many repeated sentences');
assert.equal(unique.length,0,'narrative problems found');
console.log('narrative QA passed');
