/* Match engine (match_engine.js) on the world sheets. Run: node tests/match-engine.test.cjs
 * - the locked world never changes (lock hash) and the same seed plays the same trial;
 * - a witness's words always come from the sheet: the locked world's account, or (when lying) another world's;
 * - new records always show the locked world's content;
 * - the same case plays differently: lawyers, lies, breaks and refusals vary across seeds. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const M=require('../match_engine.js');
const DIR=path.join(__dirname,'../world-sheets/cases');
const sheets=fs.readdirSync(DIR).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(DIR,f),'utf8')));
const play=(sheet,seed,truth)=>{const s=M.start(sheet,{seed,truth});for(let d=0;d<3;d++){let a;let n=0;while(s.actions>0&&(a=M.available(sheet,s)).length){
 const k=Math.floor((require('crypto').createHash('md5').update(seed+':'+d+':'+n++).digest()[0]/256)*a.length);M.act(sheet,s,a[k])}M.endDay(sheet,s)}return s};
let games=0;
for(const sheet of sheets){
 const names=new Map(sheet.people.map(p=>[p.name,p.key])),combos=new Set(),tactics=new Set(),grades=new Set();
 for(const truth of ['did','didnt','reason'])for(let i=0;i<40;i++){
  const seed=sheet.id+':'+i,s=play(sheet,seed,truth),lock=s.lock;games++;
  assert.equal(s.truth,truth);assert.equal(M.lockOf(sheet,truth),lock,'world unchanged');
  assert.deepEqual(play(sheet,seed,truth).log,s.log,'same seed, same trial');
  for(const l of s.log){const k=names.get(l.who);if(!k||!/^W/.test(k)||!l.text)continue;
   const own=t=>M.speak(sheet.worlds[t].saw[k]).map(x=>x.replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g,'그 무렵').replace(/(\d+)초쯤/g,'잠깐').replace(/(\d+)분/g,'몇 분'));   // a forgetful witness blurs times
   const pieces=l.text.split(/(?<=\.)\s+/);
   if(l.tag==='거짓'){assert.ok(['did','didnt','reason'].filter(t=>t!==truth).some(t=>pieces.every(p=>M.speak(sheet.worlds[t].saw[k]).includes(p)||own(t).includes(p))),`${seed}: a lie must be another world's account — ${l.text}`)}
   else if(!l.tag){const mine=new Set([...M.speak(sheet.worlds[truth].saw[k]),...own(truth)]);
    assert.ok(pieces.every(p=>mine.has(p)||/입니다\.$/.test(p)),`${seed}: a truthful answer must be the locked world's account — ${l.text}`)}
   if(l.tag==='번복')assert.ok(l.text.includes(M.speak(sheet.worlds[truth].saw[k])[0]),'a witness who breaks tells the locked account')}
  for(const l of s.log.filter(l=>l.tag==='새 자료')){const r=sheet.records.find(r=>l.text.includes('「'+r.title+'」'));assert.ok(l.text.endsWith(sheet.worlds[truth].records[r.id]),'records show the locked world')}
  const v=M.verdict(sheet,s,['did','didnt','reason'][i%3]);grades.add(v.grade);assert.ok(v.open.includes(truth),'the true world is never ruled out by what the court saw');
  combos.add([s.law.p.tactic,s.law.d.tactic,s.log.filter(l=>l.tag==='거짓').length,s.log.filter(l=>l.tag==='번복').length,s.log.filter(l=>l.tag==='버팀').length,s.log.filter(l=>l.tag==='제출 거부').length].join('|'));
  tactics.add(s.law.p.tactic);tactics.add(s.law.d.tactic);
 }
 assert.ok(combos.size>=20,`${sheet.id}: trials should differ (${combos.size} distinct)`);assert.equal(tactics.size,4,'every tactic appears');assert.ok(grades.size>=2,'several verdict grades occur: '+[...grades]);
 console.log(`  ✓ ${sheet.id}: 120 trials, ${combos.size} different courses, grades ${[...grades].join(' / ')}`);
}
console.log(`PASS match engine · ${games} trials`);
