const CACHE='the-verdict-live-v32-20261101';
const FILES=["./","./index.html","./style.css","./beta_patch_v11.css","./court_gameplay_v27.css","./visual_courtroom_v30.css","./judge_editorial_v24.css","./ui_experience_v31.css","./trial_play_v32.css","./deep_case_engine.js","./story_engine.js","./case_pack_engine.js","./continuity_engine.js","./npc_life_justice.js","./family_engine.js","./verdict_runtime_v31.js","./verdict_hearings_v31.js","./verdict_professions_v31.js","./verdict_ui_v31.js","./trial_core_v32.js","./trial_play_v32.js","./content-packs/drama-100-v1.json","./content-packs/court-editorial-100-v1.json","./content-packs/forensic-detail-33-v1.json","./content-packs/narrative-100-v1.json","./content-packs/index.json","./content-packs/beta-weekend-100-v1.json","./content-packs/starter-v1.json","./manifest.webmanifest","./icon.svg","./icon-192.png","./icon-512.png"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(fetch(event.request).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy))}return res}).catch(()=>caches.match(event.request)));
});
