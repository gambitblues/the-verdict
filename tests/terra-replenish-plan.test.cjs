const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {fromFiles}=require('./terra-replenish-plan.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'verdict-refill-test-'));
try{
 const policy={minPerCategory:2,targetPerCategory:3,maxNewCasesPerRun:2,usedCallsToday:0,maxCallsToday:4,
 usedUsdToday:0,maxUsdToday:2,maxEstimatedUsdPerCase:1};
 fs.writeFileSync(path.join(dir,'policy.json'),JSON.stringify(policy));
 fs.writeFileSync(path.join(dir,'stock.json'),'[]');
 const r=fromFiles([path.join(dir,'policy.json'),path.join(dir,'stock.json')]);
 assert.equal(r.ok,true);assert.equal(r.requests.length,2);
 assert.equal(fs.readdirSync(dir).length,2,'dry-run never writes');
 console.log('PASS bounded refill planning CLI is read-only');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
