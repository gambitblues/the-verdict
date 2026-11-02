/* Rebuilds the written cases from curated/part*.js + detail*.js + follow*.js + party*.js + registry.js.
 * Run: node tests/build-curated.cjs        (--check: fail if any output is out of date)
 *  - curated_cases.js     everything in one file (tests and tools load this)
 *  - curated_index.js     what the game loads at start: who, what, charge or claim, profile — plus the registry code
 *  - case-data/<id>.json  each case's courtroom detail, fetched when the case is assigned or opened (v8.2.3) */
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..'),dir=path.join(root,'curated'),out=path.join(root,'case-data');
const pick=re=>fs.readdirSync(dir).filter(f=>re.test(f)).sort();
const parts=[...pick(/^part\d+\.js$/),...pick(/^detail\d+\.js$/),...pick(/^follow\d+\.js$/),...pick(/^party\d+\.js$/)];
const head='/* THE VERDICT — written cases: story, people, trial-day acts, evidence, witnesses, endings.\n * Source parts live in curated/; built by node tests/build-curated.cjs (do not edit). The game loads curated_index.js + case-data/. */\n';
const registry=fs.readFileSync(path.join(dir,'registry.js'),'utf8');
const full=head+parts.map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n')+'\n'+registry;
/* run the full build once to get every case with its detail merged (sex, profile, follow-ups, party questions) */
const box={window:{}};vm.createContext(box);vm.runInContext(full,box);
const cases=box.window.VerdictCurated.cases;
const INDEX_KEYS=['id','logline','summary','people','profile','sex','charge','claim','decision','demand'];
const index={},detail={};
for(const [id,c] of Object.entries(cases)){index[id]={};detail[id]={};
 for(const [k,v] of Object.entries(c))(INDEX_KEYS.includes(k)?index:detail)[id][k]=v}
const indexJs='/* THE VERDICT — written-case index (built by node tests/build-curated.cjs; do not edit).\n * Courtroom detail for each case is in case-data/<id>.json and loads when the case is assigned or opened. */\n'
 +'window.VERDICT_CURATED_INDEX='+JSON.stringify(index)+';\n'+registry;
const files={[path.join(root,'curated_cases.js')]:full,[path.join(root,'curated_index.js')]:indexJs};
for(const [id,d] of Object.entries(detail))files[path.join(out,id+'.json')]=JSON.stringify(d)+'\n';
if(process.argv.includes('--check')){
 const stale=Object.entries(files).filter(([f,txt])=>!fs.existsSync(f)||fs.readFileSync(f,'utf8')!==txt).map(([f])=>path.relative(root,f));
 if(stale.length){console.error('FAIL out of date — run: node tests/build-curated.cjs\n  '+stale.slice(0,8).join('\n  '));process.exit(1)}
 console.log(`PASS curated outputs up to date (${Object.keys(detail).length} cases)`);process.exit(0);
}
fs.mkdirSync(out,{recursive:true});
for(const [f,txt] of Object.entries(files))fs.writeFileSync(f,txt);
console.log(`curated_cases.js, curated_index.js (${Math.round(indexJs.length/1024)}KB) and ${Object.keys(detail).length} case-data files from ${parts.length} parts`);
