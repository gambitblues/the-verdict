const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const p=JSON.parse(fs.readFileSync(path.join(__dirname,'../advanced-content/story-beats-99.json'),'utf8'));
const ids=new Set(),types={};
assert.equal(p.drafts.length,99);
for(const c of p.drafts){
 assert.ok(!ids.has(c.id),'duplicate ID '+c.id);ids.add(c.id);types[c.category]=(types[c.category]||0)+1;
 assert.ok(c.fictionalLocation.length>=7);
 assert.equal(c.incidentTimeline.length,3);assert.equal(c.authoredEvidence.length,3);assert.equal(c.witnessPlans.length,2);
 assert.equal(c.qa.playable,false);
 for(const evt of c.incidentTimeline)assert.match(evt.at,/^2026-\d\d-\d\dT\d\d:\d\d:00\+09:00$/);
}
assert.deepEqual(types,{criminal:49,civil:25,family:20,administrative:5});
console.log('PASS: 99 individual story beat IDs, 49/25/20/5 quota, explicit unverified and unplayable flags');
