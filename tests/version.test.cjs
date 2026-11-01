/* The version shown in the app, the service-worker cache and the newest CHANGELOG entry must agree. */
const fs=require('fs'),path=require('path'),root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),log=fs.readFileSync(path.join(root,'docs/CHANGELOG.md'),'utf8');
const v=(html.match(/VERDICT_VERSION='([\d.]+)'/)||[])[1],c=(sw.match(/the-verdict-v([\d.]+)'/)||[])[1],l=(log.match(/^## v([\d.]+)/m)||[])[1];
if(!v||v!==c||v!==l){console.error('version mismatch',{index:v,sw:c,changelog:l});process.exit(1)}
console.log('PASS: version',v);
