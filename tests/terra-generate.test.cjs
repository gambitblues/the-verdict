const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {safeFolder,produce}=require('./terra-generate.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'verdict-cli-test-'));
try{
 const dest=safeFolder(root,'terra-test-001');
 assert.equal(dest,path.join(root,'pending','terra-test-001'));
 assert.throws(()=>safeFolder(root,'../test-escape'),/unsafe/);
 let calls=0;
 await (async()=>{
  try{
   await produce({seed:{id:'../unsafe',category:'violence',premise:'제작을 시작하면 안 되는 위험한 사건 ID를 포함한 테스트 사례입니다.'},root,
    fetcher:async()=>{calls++;throw Error('unexpected API call')},apiKey:'fake'});
   assert.fail('invalid seed must throw');
  }catch(e){assert.ok(/ID/.test(e.message))}
 })();
 assert.equal(calls,0);
 assert.equal(fs.existsSync(path.join(root,'pending')),false);
 console.log('PASS Terra operator CLI path isolation and invalid-seed preflight');
}finally{fs.rmSync(root,{recursive:true,force:true})}
