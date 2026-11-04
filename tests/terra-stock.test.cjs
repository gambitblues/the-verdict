const assert=require('node:assert/strict');
const {inspect}=require('./terra-stock.cjs');
assert.throws(()=>inspect({root:process.cwd(),id:'../escape'}),/ID/);
assert.throws(()=>inspect({root:process.cwd(),id:'terra-nonexistent-777'}),/ENOENT/);
console.log('PASS automated stocking inspection: rejects path escapes and absent QA evidence');
