const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../advanced-content/production-100.json'),'utf8'));
const counts={criminal:0,civil:0,family:0,administrative:0},ids=new Set();
for(const c of data.cases){
 assert.ok(!ids.has(c.id),'duplicate '+c.id);ids.add(c.id);
 assert.ok(Object.hasOwn(counts,c.kind));counts[c.kind]++;
 assert.equal(c.playable,false,'Unverified case marked playable: '+c.id);
 if(c.source){
  assert.equal(c.source.verification,'docket_listed_only');
  assert.match(c.source.bulletinUrl,/^https:\/\/www\.scourt\.go\.kr\//);
  assert.match(c.source.caseNumber,/\d{4}(도|다|므|두)\d+/);
  assert.equal(c.stage,'source_candidate');
 } else assert.equal(c.stage,'research_pending');
}
assert.equal(data.cases.length,100);
assert.deepEqual(counts,{criminal:50,civil:25,family:20,administrative:5});
assert.equal(data.completedCases,0);
console.log('PASS Advanced 100-case production slots, category quotas, explicit unverified status and unique IDs');
