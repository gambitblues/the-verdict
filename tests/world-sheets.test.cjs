/* World sheet check (world-sheets/cases/*.json). Run: node tests/world-sheets.test.cjs [file ...]
 * A sheet fixes what really happened in each of the three worlds; the courtroom engine reads it later.
 * Errors fail the run; warnings are printed. Checks:
 *  - required fields; ids unique; every reference (place, person, device, record) exists
 *  - source: a real-case sheet names court, case number, date, https url, retrieval date and is fictionalized
 *  - the three worlds each fill every record, what each witness saw, what the accused and complainant know
 *  - clock times run forward; the three worlds are told apart by at least one record for every pair
 *  - player-facing card text has no gender-assuming words unless the story fixes the sexes */
const fs=require('fs'),path=require('path');
const DIR=path.join(__dirname,'../world-sheets/cases');
const files=process.argv.slice(2).length?process.argv.slice(2):fs.existsSync(DIR)?fs.readdirSync(DIR).filter(f=>f.endsWith('.json')).map(f=>path.join(DIR,f)):[];
const TRUTHS=['did','didnt','reason'],KINDS=['criminal','civil','decision'];
const CATS=['homicide','sexual','violence','financial','property','reputation','civil','family','professional','public'];
const GENDERED=/남자|여자|남성|여성|아빠|엄마|남편|아내|장남|장녀|누나|오빠|언니|사위|며느리/;
const sec=t=>{const m=/^(\d\d):(\d\d)(?::(\d\d))?$/.exec(String(t||''));return m?(+m[1])*3600+(+m[2])*60+(+(m[3]||0)):null};
let failed=0;
for(const file of files){
 const E=[],W=[],err=m=>E.push(m),warn=m=>W.push(m);
 let s;try{s=JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){console.log(`✗ ${path.basename(file)}: JSON을 읽을 수 없음 — ${e.message}`);failed++;continue}
 const need=(o,keys,at)=>{for(const k of keys)if(o?.[k]===undefined||o?.[k]===null||o?.[k]==='')err(`${at}.${k} 없음`)};
 if(s.format!=='verdict-world-sheet/v1')err('format은 "verdict-world-sheet/v1"');
 if(s.id!==path.basename(file,'.json'))err(`id(${s.id})와 파일 이름이 다름`);
 if(!['draft','review','ready'].includes(s.status))err('status는 draft · review · ready 중 하나');
 // source
 if(!['original','real_case'].includes(s.source?.type))err('source.type은 original 또는 real_case');
 if(s.source?.type==='real_case'){need(s.source,['court','caseNumber','decidedAt','url','retrievedAt'],'source');
  if(s.source.url&&!/^https:\/\//.test(s.source.url))err('source.url은 https 주소');
  if(s.source.fictionalized!==true)err('source.fictionalized: true (실명·실제 장소를 바꿨다는 확인)');
  if(!Array.isArray(s.source.usedFacts)||!s.source.usedFacts.length)err('source.usedFacts: 판례에서 가져온 사실 목록');}
 // card
 const c=s.card||{};need(c,['kind','category','title','summary','accused','complainant'],'card');
 if(c.kind&&!KINDS.includes(c.kind))err('card.kind는 criminal · civil · decision');
 if(c.category&&!CATS.includes(c.category))err('card.category는 '+CATS.join(' · '));
 if(c.kind==='criminal'){need(c.charge,['name','law','min','max'],'card.charge');if(c.charge&&!(c.charge.max>=c.charge.min))err('card.charge 형량 범위가 거꾸로')}
 if(c.kind==='civil'){need(c.claim,['amount','what'],'card.claim');if(!Array.isArray(c.claim?.fair)||c.claim.fair.length!==2||c.claim.fair[1]>c.claim.amount)err('card.claim.fair는 [최소, 최대]이고 최대 ≤ 청구액')}
 if(c.kind==='decision')need(c.decision,['what','yes','no'],'card.decision');
 // people, places, devices, records
 const P=new Map();for(const p of s.people||[]){need(p,['key','name','role','age'],'people');if(P.has(p.key))err('people 중복 key '+p.key);P.set(p.key,p)}
 for(const k of [c.accused,c.complainant])if(k&&!P.has(k))err(`card가 가리키는 인물 ${k} 없음`);
 const witnesses=[...P.keys()].filter(k=>/^W\d+$/.test(k));if(!witnesses.length)err('증인(W1, W2 …)이 한 명 이상 필요');
 const PL=new Set((s.places||[]).map(x=>x.id)),D=new Map((s.devices||[]).map(x=>[x.id,x]));
 for(const d of s.devices||[]){need(d,['id','kind','covers'],'devices');if(typeof d.clockOffsetSec!=='number')err(`devices ${d.id}: clockOffsetSec(실제보다 빠르면 +초) 숫자`)}
 const R=new Map();for(const r of s.records||[]){need(r,['id','title','kind','by','how'],'records');if(R.has(r.id))err('records 중복 id '+r.id);R.set(r.id,r);
  if(r.device&&!D.has(r.device))err(`records ${r.id}: 기기 ${r.device} 없음`);
  if(typeof r.first!=='boolean')err(`records ${r.id}: first(처음부터 제출되는지) true/false`);
  if(r.first===false&&!r.unlock)err(`records ${r.id}: 처음엔 없는 자료는 unlock(어떻게 나오는지) 필요`)}
 if(R.size<3)err('records는 3개 이상');
 // common timeline
 if(!/^\d{4}-\d\d-\d\d$/.test(s.common?.date||''))err('common.date는 YYYY-MM-DD');
 const ordered=(list,at)=>{let last=-1,day=0;for(const e of list||[]){let t=sec(e.at);if(t!=null&&t+day<last&&last-(t+day)>43200)day+=86400;if(t!=null)t+=day;if(t==null){err(`${at}: 시각 "${e.at}" 형식은 HH:MM 또는 HH:MM:SS`);continue}if(t<last)err(`${at}: ${e.at}가 앞 항목보다 이름`);last=t;
  if(e.place&&!PL.has(e.place))err(`${at} ${e.at}: 장소 ${e.place} 없음`);for(const w of e.who||[])if(!P.has(w))err(`${at} ${e.at}: 인물 ${w} 없음`)}};
 if(!(s.common?.timeline||[]).length)err('common.timeline 비어 있음');ordered(s.common?.timeline,'common.timeline');
 // worlds
 for(const t of TRUTHS){const w=s.worlds?.[t];if(!w){err(`worlds.${t} 없음`);continue}
  need(w,['label','legal','act','motive','cause'],'worlds.'+t);ordered(w.timeline,`worlds.${t}.timeline`);
  for(const id of R.keys())if(!w.records?.[id])err(`worlds.${t}.records에 ${id} 내용이 없음`);
  for(const id of Object.keys(w.records||{}))if(!R.has(id))err(`worlds.${t}.records: 정의되지 않은 자료 ${id}`);
  for(const k of witnesses)if(!w.saw?.[k])err(`worlds.${t}.saw: 증인 ${k}가 실제로 본 것`);
  if(c.kind==='criminal'){if(!w.sentencing)warn(`worlds.${t}.sentencing(양형 인자)이 없음`);else for(const f of ['means','degree','count','setting','harm','victim','planning','after'])if(!w.sentencing[f])err(`worlds.${t}.sentencing.${f} 없음`)}
  for(const k of [c.accused,c.complainant])if(k&&!w.knows?.[k])err(`worlds.${t}.knows: ${k}가 아는 것`);
  }
 // the worlds must be told apart
 if(s.worlds)for(const [a,b] of [['did','didnt'],['did','reason'],['didnt','reason']]){
  const diff=[...R.keys()].filter(id=>s.worlds[a]?.records?.[id]!==s.worlds[b]?.records?.[id]);
  if(!diff.length)err(`${a}와 ${b}를 가르는 자료가 하나도 없음`);
  const firstOnly=diff.filter(id=>R.get(id).first);if(diff.length&&!firstOnly.length)warn(`${a}/${b}: 처음 제출 자료로는 갈리지 않음 (주문해야만 갈림)`);}
 if(s.worlds){const decisive=[...R.keys()].filter(id=>R.get(id).first&&new Set(TRUTHS.map(t=>s.worlds[t]?.records?.[id])).size===3);
  if(decisive.length)warn('처음 제출 자료 하나만으로 세 세계가 다 갈림: '+decisive.join(', ')+' — 너무 쉬울 수 있음');}
 for(const d of D.values())if(d.clockOffsetSec){const used=[...R.values()].filter(r=>r.device===d.id);
  if(!used.length)warn(`기기 ${d.id}의 시계 오차가 어느 자료에도 쓰이지 않음`);}
 // player-facing words
 const fixedSex=[c.accused,c.complainant].some(k=>P.get(k)?.sex);
 for(const [k,v] of [['card.title',c.title],['card.summary',c.summary]])if(GENDERED.test(v||'')&&!fixedSex)err(`${k}: 성별을 단정하는 말 "${(v.match(GENDERED)||[])[0]}" (성별이 정해진 사건이면 people에 sex를 적기)`);
 const name=path.basename(file);
 if(E.length){failed++;console.log(`✗ ${name}\n  - `+E.join('\n  - '))}else console.log(`✓ ${name} · ${s.status} · 자료 ${R.size} · 증인 ${witnesses.length}`);
 for(const m of W)console.log('  ! '+m);
}
if(!files.length)console.log('world-sheets/cases 에 사건이 없음');
if(failed){console.log(`\n${failed}건 실패`);process.exit(1)}
console.log(`PASS world sheets ${files.length}`);
