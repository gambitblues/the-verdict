const CACHE='the-verdict-profiles-v20';
const FILES=['./','./index.html','./style.css','./beta_patch_v11.css','./game.js','./beta_patch_v11.js','./beta_patch_v12.js','./beta_patch_v13.js','./beta_patch_v14.js','./beta_narrative_v15.js','./beta_drama_v16.js','./beta_hearings_v17.js','./beta_realtime_v18.js','./beta_world_v19.js','./player_profiles_v20.js','./content-packs/drama-100-v1.json','./content-packs/narrative-100-v1.json','./deep_case_engine.js','./story_engine.js','./case_pack_engine.js','./continuity_engine.js','./npc_life_justice.js','./family_engine.js','./content-packs/index.json','./content-packs/beta-weekend-100-v1.json','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(fetch(event.request).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy))}return res}).catch(()=>caches.match(event.request)));
});
