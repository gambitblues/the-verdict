const assert=require('node:assert/strict');
const Runner=require('./terra-refill-execute.cjs');
assert.throws(()=>Runner.config({}),/서버 API 키/);
const env={OPENAI_API_KEY:'x',SUPABASE_URL:'https://db.example.com',SUPABASE_SERVICE_ROLE_KEY:'y',
 TERRA_MIN_STOCK:'2',TERRA_TARGET_STOCK:'3',TERRA_MAX_BATCH:'2',TERRA_MAX_CALLS_DAY:'8',TERRA_MAX_USD_DAY:'3',
 TERRA_MAX_USD_CASE:'1',TERRA_MAX_STOCK_CATEGORY:'50'};
const c=Runner.config(env);
assert.equal(c.policy.maxNewCasesPerRun,2);
assert.equal(c.policy.maxEstimatedUsdPerCase,1);
assert.ok(Runner.THEMES.financial.length>20);
console.log('PASS server-only replenishment configuration refuses missing secrets');