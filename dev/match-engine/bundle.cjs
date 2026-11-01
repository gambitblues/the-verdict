/* Build one self-contained page of the match engine dev screen (engine + sheets + app inline) for sharing as a private page.
 * Usage: node dev/match-engine/bundle.cjs <out.html> */
const fs=require('fs'),path=require('path'),root=path.join(__dirname,'../..');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8'),app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8'),eng=fs.readFileSync(path.join(root,'match_engine.js'),'utf8');
const sheets=Object.fromEntries([...html.matchAll(/<option value="([a-z0-9-]+)"/g)].map(m=>m[1]).map(id=>[id,JSON.parse(fs.readFileSync(path.join(root,'world-sheets/cases',id+'.json'),'utf8'))]));
const style=html.match(/<style>([\s\S]*?)<\/style>/)[1]
 .replace(':root{--bg','body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);background:var(--bg);z-index:10}\n:root{--bg')
 .replace(/@media \(prefers-color-scheme:dark\)\{:root:not\(\[data-theme="light"\]\)\{([^}]*)\}\}/,(m,v)=>`@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${v};color-scheme:dark}}\n:root[data-theme="dark"]{${v};color-scheme:dark}`)
 .replace('main{max-width:860px;margin:auto;padding:16px}','main{max-width:860px;margin:auto;padding-block:16px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}');
const body=html.match(/<main>[\s\S]*<\/main>/)[0];
const appInline=app.replace("async function load(id){if(!sheets[id])sheets[id]=await (await fetch(`../../world-sheets/cases/${id}.json`)).json();return sheets[id]}","async function load(id){return window.__SHEETS[id]}");
const out=`<title>법정 매치 엔진</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>${style}</style>\n${body}\n<script>window.__SHEETS=${JSON.stringify(sheets)};</script>\n<script>${eng}</script>\n<script>${appInline}</script>\n`;
if(!appInline.includes('window.__SHEETS'))throw Error('loader not replaced');
fs.writeFileSync(process.argv[2]||'match-engine.html',out);console.log('wrote',out.length,'bytes');
