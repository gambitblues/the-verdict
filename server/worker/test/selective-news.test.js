import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const runtime=readFileSync(fileURLToPath(new URL('../../../game_runtime.js',import.meta.url)),'utf8');
const start=runtime.indexOf('function shouldPreReport(');
const end=runtime.indexOf('function createGeneratedCase(',start);
assert.ok(start>=0&&end>start,'selective reporting decision exists');
const shouldPreReport=Function(runtime.slice(start,end)+';return shouldPreReport;')();

test('routine cases never require incident-first news',()=>{
 for(const importance of [1,2,3])for(const roll of [0,.1,.4,.9])
  assert.equal(shouldPreReport({importance},roll),false);
});
test('even high-profile cases do not all receive breaking-news coverage',()=>{
 assert.equal(shouldPreReport({importance:4},.1),true);
 assert.equal(shouldPreReport({importance:5},.44),true);
 assert.equal(shouldPreReport({importance:5},.45),false);
 assert.equal(shouldPreReport({importance:5},.99),false);
});
test('routine filings remain in the court inbox instead of generating an automatic headline',()=>{
 assert.match(runtime,/const c=createGeneratedCase\(null,'auto'\)/);
 assert.match(runtime,/S\.nextCaseWeek=S\.week\+\(c\?\.newsLifecycle==='reported'\?8:0\)/);
 assert.match(runtime,/CASES\.push\(c\);S\.generatedCases\.push\(c\)/);
 assert.ok(!runtime.includes("news('새 사건 배당',`${c.name}"));
});
