/* Rebuilds curated_cases.js from curated/part*.js + curated/detail*.js + curated/registry.js. Run: node tests/build-curated.cjs */
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'..','curated');
const parts=fs.readdirSync(dir).filter(f=>/^part\d+\.js$/.test(f)).sort().concat(fs.readdirSync(dir).filter(f=>/^detail\d+\.js$/.test(f)).sort());
const head='/* THE VERDICT — 30 curated cases: story, people, trial-day acts, evidence, witnesses, endings.\n * Source parts live in curated/; this file is what the game loads. Edit the parts, then run: node tests/build-curated.cjs */\n';
const body=parts.map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n')+'\n'+fs.readFileSync(path.join(dir,'registry.js'),'utf8');
fs.writeFileSync(path.join(__dirname,'..','curated_cases.js'),head+body);
console.log('curated_cases.js rebuilt from',parts.join(', '));
