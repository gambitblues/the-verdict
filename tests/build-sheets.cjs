/* Builds world_sheets.js (game data) from world-sheets/cases/*.json. Run: node tests/build-sheets.cjs
 * - only sheets marked review or ready go into the game (drafts stay in the folder);
 * - people written with real-looking names (clinic-001, gym-001) are turned into name tokens ({A}, {W1}…) so the game
 *   gives them its own people, like every other case;
 * - sheets that are not one of the 60 curated cases get a case-pack archetype, so they join the offer pool. */
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),dir=path.join(root,'world-sheets','cases');
const curatedIds=new Set();
{const src=fs.readFileSync(path.join(root,'curated_cases.js'),'utf8');for(const m of src.matchAll(/^ ?id:'([a-z0-9-]+)'/gm))curatedIds.add(m[1]);
 for(const m of src.matchAll(/\{id:'([a-z0-9-]+)',/g))curatedIds.add(m[1]);}
const PAIRS={'이':['이','가'],'가':['이','가'],'은':['은','는'],'는':['은','는'],'을':['을','를'],'를':['을','를'],'과':['과','와'],'와':['과','와']};
const jong=w=>{const c=String(w).slice(-1).charCodeAt(0);return c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28!==0};
const rieul=w=>{const c=String(w).slice(-1).charCodeAt(0);return c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28===8};
const particle=(n,p)=>p==='으로'||p==='로'?n+(jong(n)&&!rieul(n)?'으로':'로'):n+(PAIRS[p]?(jong(n)?PAIRS[p][0]:PAIRS[p][1]):p);
const roleFill=(t,sheet)=>String(t||'').replace(/\{([A-Z][0-9]?)(?:>([A-Z][0-9]?))?(?:\|([가-힣]+))?\}/g,(m,k,by,p)=>{
 const crim=sheet.card.kind==='criminal';const n=by?'선배':k==='A'?(crim?'피고인':'원고'):k==='B'?(crim?'피해자':'피고'):'증인';return p?particle(n,p):n});

/* literal names → tokens. A name followed by a particle that changes with the final consonant becomes {K|p}. */
function tokenize(sheet){
 const map=sheet.people.filter(p=>/^(A|B|W\d+)$/.test(p.key)&&/^[가-힣]{2,4}$/.test(p.name)).map(p=>[p.name,p.key]);
 if(!map.length)return sheet;
 const walk=v=>typeof v==='string'?map.reduce((s,[n,k])=>s.replace(new RegExp(n+'(으로|이|가|은|는|을|를|과|와|로)?(?![가-힣])|'+n,'g'),(m,p)=>p?`{${k}|${p==='가'?'이':p==='는'?'은':p==='를'?'을':p==='와'?'과':p}}`:`{${k}}`),v)
  :Array.isArray(v)?v.map(walk):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,walk(x)])):v;
 const out=walk(sheet);out.people=out.people.map(p=>map.some(([,k])=>k===p.key)?{...p,name:`{${p.key}}`}:p);return out;
}

const KEY=[[/횡령|배임/,'embezzle'],[/컴퓨터등사용사기|사기/,'fraud'],[/뇌물|직권/,'bribe'],[/개인정보|정보통신/,'privacy'],[/강간|추행|촬영|성폭력/,'sexual'],[/스토킹/,'stalking'],[/살인|치사$/,'murder'],[/과실|교통/,'accident'],[/폭행|상해/,'assault'],[/방화|실화/,'fire'],[/명예/,'defamation']];
function archetype(s){
 const c=s.card,ch=c.charge||{},key=(KEY.find(([re])=>re.test(ch.name||''))||[0,c.category==='public'?'bribe':'fraud'])[1];
 const kind=c.kind==='criminal'?'criminal':'civil';const ck={sexual:'sexual',stalking:'stalking',murder:'murder',accident:'accident',assault:'assault',fire:'fire'};
 const base=kind==='civil'?'contract':key;
 const first=s.records.filter(r=>r.first).slice(0,3);while(first.length<3)first.push(s.records.find(r=>!first.includes(r)));
 const W=s.people.filter(p=>/^W\d+$/.test(p.key));
 const txt=t=>roleFill(t,s).slice(0,880);
 return {id:s.id,category:c.category,baseKey:base,kind,tag:(ch.name||c.title).length<3?ch.name+' 사건':(ch.name||c.title),icon:'⚖️',importance:ch.max>=10||ch.life?5:ch.max>=5?4:3,
  legal:`${ch.name||''} (${ch.law||''})`.trim(),title:c.title,premise:txt(c.summary),
  trigger:txt(s.common.timeline[0]?.what||c.title),motive:'법정에서 가려야 할 사정',relationship:txt(W.map(w=>w.role).join(', ')||'당사자'),
  incident:{cause:txt(s.common.timeline[0]?.what||c.title),action:txt(s.common.timeline[Math.floor(s.common.timeline.length/2)]?.what||c.title),aftermath:txt(s.common.timeline.at(-1)?.what||c.title)},
  evidence:first.map(r=>({title:r.title,proves:`${r.kind} · ${txt(r.how)}`.slice(0,800),limitation:'원본과 다른 기록을 함께 봐야 합니다'})),
  questions:W.slice(0,3).map(w=>`${w.role}에게 그날 직접 본 것을 묻는다`).concat(['피고인에게 직접 묻는다','어떤 자료를 더 불러야 하는가','기록끼리 시각이 맞는가']).slice(0,3),
  causalTags:[c.category,ch.name||c.title,'세계 시트'].map(x=>String(x).slice(0,40))};
}

const sheets={},pack={format:'the-verdict-casepack/v1',packId:'world-sheets-v1',version:'1.0.0',title:'세계 시트 사건',archetypes:[]};
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort()){
 const s=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
 if(!['review','ready'].includes(s.status))continue;
 const g=tokenize(s);delete g.source;delete g.traps;delete g.screen;delete g.open;
 sheets[g.id]=g;
 if(!curatedIds.has(g.id))pack.archetypes.push(archetype(g));
}
const n=pack.archetypes.length;pack.version=`1.${n}.${Object.keys(sheets).length}`;
const head='/* THE VERDICT — world sheets for the match engine (game data). Built from world-sheets/cases/*.json by\n * node tests/build-sheets.cjs — do not edit by hand. Only sheets marked review or ready are here. */\n';
const out=head+'window.VerdictSheets={cases:'+JSON.stringify(sheets)+',\npack:'+JSON.stringify(pack)+'};\n',file=path.join(root,'world_sheets.js');
if(process.argv.includes('--check')){const same=fs.existsSync(file)&&fs.readFileSync(file,'utf8')===out;if(!same){console.error('FAIL world_sheets.js is out of date — run: node tests/build-sheets.cjs');process.exit(1)}console.log('PASS world_sheets.js is up to date');process.exit(0)}
fs.writeFileSync(file,out);
console.log(`world_sheets.js: ${Object.keys(sheets).length} sheets (${Object.keys(sheets).filter(id=>curatedIds.has(id)).length} curated, ${n} new in the pool)`);
