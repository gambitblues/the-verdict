/* THE VERDICT service worker — network first, offline fallback. Bump CACHE on every release. */
const CACHE='the-verdict-v7.0.1'; // includes the courtroom visuals (court_visuals.js/.css)
const FILES=['./','./index.html','./game.css','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./apple-touch-icon.png',
 './names.js','./deep_case_engine.js','./story_engine.js','./case_pack_engine.js','./curated_cases.js','./continuity_engine.js','./npc_life_justice.js','./family_engine.js',
 './save_store.js','./court_visuals.js','./court_visuals.css','./game_runtime.js','./game_hearings.js','./game_professions.js','./game_ui.js','./trial_core.js','./media_desk.js','./trial_play.js','./world_feed.js','./people_map.js','./v6_world.js','./app_install.js',
 './content-packs/index.json','./content-packs/starter-v1.json','./content-packs/beta-weekend-100-v1.json','./content-packs/v6-new-30-v1.json','./content-packs/narrative-100-v1.json',
 './content-packs/drama-100-v1.json','./content-packs/court-editorial-100-v1.json','./content-packs/forensic-detail-33-v1.json'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(fetch(event.request).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy))}return res}).catch(()=>caches.match(event.request)));
});
