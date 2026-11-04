import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {validateAuthorSeed,seedToTerraInput}=require('../src/terra_author_seed.cjs');
const {parseAuthorMarkdown}=require('../src/terra_author_markdown.cjs');
const example=readFileSync(new URL('../../../world-sheets/author-template.md',import.meta.url),'utf8');
const json=JSON.parse(readFileSync(new URL('../../../world-sheets/author-template.json',import.meta.url),'utf8'));

test('short Korean markdown compiles to valid Terra author input without inventing facts',()=>{
 const parsed=parseAuthorMarkdown(example,'traffic-fatal-001.md');
 assert.equal(validateAuthorSeed(parsed).ok,true);
 assert.equal(parsed.immutableFacts.length,3);
 assert.equal(parsed.evidenceLeads[1].exists,'possible');
 assert.ok(parsed.unknowns[0].includes('음주'));
 const terra=seedToTerraInput(parsed);
 assert.equal(terra.id,'traffic-fatal-001');
 assert.ok(terra.premise.includes('음주 여부'));
 assert.ok(terra.premise.includes('immutableFacts'));
 assert.ok(!terra.premise.includes('피고인은 술에 취했다.'));
});
test('JSON author template is also structurally valid',()=>{
 assert.deepEqual(validateAuthorSeed(json).errors,[]);
 assert.equal(seedToTerraInput(json).category,'homicide');
});
test('missing fixed truths, evidence provenance or confirmed status block Terra creation',()=>{
 assert.equal(validateAuthorSeed({...json,immutableFacts:[]}).ok,false);
 assert.equal(validateAuthorSeed({...json,status:'ready'}).ok,false);
 assert.equal(validateAuthorSeed({...json,evidenceLeads:[{...json.evidenceLeads[0],source:''},json.evidenceLeads[1]]}).ok,false);
 assert.throws(()=>seedToTerraInput({...json,immutableFacts:[]}),/고정 사실/);
 assert.throws(()=>parseAuthorMarkdown(example.replace('고정 사실','완료 사실'),'bad.md'));
});
test('author-provided unknown details are not silently promoted to confirmed facts',()=>{
 const parsed=parseAuthorMarkdown(example,'traffic-fatal-001.md');
 const confirmed=parsed.immutableFacts.map(f=>f.fact).join(' ');
 assert.ok(!confirmed.includes('식당을 방문했다는 사실만으로'));
 assert.equal(parsed.evidenceLeads[1].exists,'possible');
 assert.ok(parsed.unknowns.length>0);
});
