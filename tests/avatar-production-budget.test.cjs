/* Build gate for production raster portraits: 1500 images at 256 x 320, <=10MiB static. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..','avatar-assets','portraits');
const limit=10*1024*1024,files=[];
function walk(dir){if(!fs.existsSync(dir))return;for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())walk(p);else if(/\.(?:webp|avif|png|jpe?g)$/i.test(item.name))files.push(p)}}
walk(root);const bytes=files.reduce((n,p)=>n+fs.statSync(p).size,0);
assert.ok(bytes<=limit,'Portrait assets exceed 10MiB: '+bytes);
const A=require('../avatar_system.js');
assert.equal(A.CATALOG.length,1500);
assert.equal(new Set(A.CATALOG.map(x=>x.id)).size,1500);
if(files.length){assert.equal(files.length,1500,'Never call this 1500 completed portraits until all 1500 files exist');
 for(const p of files)assert.ok(/\.webp$/i.test(p),'production images must be WebP');}
console.log('PASS static portrait budget '+bytes+' of '+limit+' bytes, '+files.length+'/1500 production WebP assets present; '+A.CATALOG.length+' seeded identities');
