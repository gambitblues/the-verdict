import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Trial from '../src/terra_cloud_trial_qa.cjs';
const fixture=JSON.parse(fs.readFileSync(new URL('../../../world-sheets/cases/terra-civil-rooftop-water.json',import.meta.url),'utf8'));
test('shared deterministic engine plays 18 immutable trials in Cloudflare path',()=>{
 const before=JSON.stringify(fixture);
 const out=Trial.run(fixture);
 assert.equal(out.ok,true,JSON.stringify(out));
 assert.equal(out.completed,18);
 assert.equal(JSON.stringify(fixture),before);
});
test('incomplete truths fail closed',()=>{
 const bad=Trial.run({id:'bad',worlds:{did:{}}});
 assert.equal(bad.ok,false);
});
