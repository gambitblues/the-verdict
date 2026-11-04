/* The version shown in the app, the service-worker cache and the newest CHANGELOG entry must agree. */
const fs=require('fs'),path=require('path'),root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),log=fs.readFileSync(path.join(root,'docs/CHANGELOG.md'),'utf8');
const v=(html.match(/VERDICT_VERSION='([\d.]+)'/)||[])[1],c=(sw.match(/the-verdict-v([\d.]+)'/)||[])[1],l=(log.match(/^## v([\d.]+)/m)||[])[1];
if(!v||v!==c||v!==l){console.error('version mismatch',{index:v,sw:c,changelog:l});process.exit(1)}
console.log('PASS: version',v);
// every script the page loads must be in the offline cache, or the home-screen app breaks after an update
{const fs=require('fs'),p=require('path');const html=fs.readFileSync(p.join(__dirname,'../index.html'),'utf8'),sw=fs.readFileSync(p.join(__dirname,'../sw.js'),'utf8');
 const miss=[...html.matchAll(/src="\.\/([^"]+\.js)"/g)].map(m=>m[1]).filter(f=>!sw.includes("'./"+f+"'"));
 if(miss.length)throw new Error('sw.js does not precache: '+miss.join(', '));}

// Guard the agreed entry flow against the legacy local-slot launcher returning.
{
 const runtime=fs.readFileSync(path.join(root,'game_runtime.js'),'utf8');
 const launcher=runtime.slice(runtime.indexOf('/* source: player_profiles_v20.js */'),runtime.indexOf('/* source: beta_narrative_v15.js */'));
 for(const s of ['data-profile="1"','data-profile="2"','id="profile-import"'])if(launcher.includes(s))throw Error('old entry control: '+s);
 if(!launcher.includes('>이어하기</button>')||!launcher.includes('>새로하기</button>'))throw Error('entry buttons missing');
 console.log('PASS: entry has only 이어하기 and 새로하기');
}

// A logged-in new-career action must reset server state before clearing browser state.
{
 const gate=fs.readFileSync(path.join(root,'auth_gate.js'),'utf8');
 const runtime=fs.readFileSync(path.join(root,'game_runtime.js'),'utf8');
 const sql=fs.readFileSync(path.join(root,'server/supabase/035_player_career_reset.sql'),'utf8');
 if(!gate.includes("rest('rpc/reset_player_career'")||!gate.includes('if(!r.ok)')||
    !gate.includes('if(await r.json()!==true)'))throw Error('server-confirmed reset guard missing');
 if(!runtime.includes('await window.VerdictAuth.resetCareer()'))throw Error('new career not routed through authenticated reset');
 if(!sql.includes('where user_id = uid')||!sql.includes('auth.uid()')||
    !sql.includes('grant execute on function public.reset_player_career() to authenticated'))throw Error('user-scoped SQL reset missing');
 console.log('PASS: server-authoritative per-user career reset contract');
}

// After a successful authenticated reset, the next boot must open judge creation.
{
 const gate=fs.readFileSync(path.join(root,'auth_gate.js'),'utf8');
 const runtime=fs.readFileSync(path.join(root,'game_runtime.js'),'utf8');
 if(!gate.includes("sessionStorage.setItem('vauth_new_career',uid)"))throw Error('reset onboarding token missing');
 if(!runtime.includes("sessionStorage.getItem('vauth_new_career')")||!runtime.includes('if(!has){setup();return}'))throw Error('post-reset onboarding bypass missing');
 console.log('PASS: post-reset judge creation follows server confirmation');
}
