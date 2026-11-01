/* Story QA for Advanced draft cases (advanced-content). Reports what breaks immersion:
 * - lines repeated across 3+ cases (stock answers, stock questions, stock arguments),
 * - an event whose own text names a different clock time than its timestamp,
 * - witness "roles" that are topics instead of people, missing titles.
 * A case may only be marked playable (qa.runtime / qa.fullPlaythrough) when it has none of these. */
const assert=require('node:assert/strict');
const cases=require('../advanced-content/assembled-99.cjs').cases;
const owner=new Map(),problems=new Map(),flag=(id,p)=>{if(!problems.has(id))problems.set(id,new Set());problems.get(id).add(p)};
const norm=s=>s.replace(/\d{4}-\d\d-\d\d|\d\d:\d\d|[\d,]+원/g,'#');
const texts=c=>{const out=[];const v=c.definition.variants;
 for(const t of ['did','didnt','reason']){for(const e of v[t].evidence)out.push(e.excerpt);
  for(const w of v[t].witnesses)for(const q of Object.values(w.script)){out.push(q.prompt);for(const r of Object.values(q.responses))out.push(r.text)}}
 for(const l of c.dialogue?.lines||[])out.push(l.text);return out.filter(s=>typeof s==='string'&&s.length>=12)};
for(const c of cases)for(const s of new Set(texts(c).map(norm))){if(!owner.has(s))owner.set(s,new Set());owner.get(s).add(c.id)}
for(const [s,ids] of owner)if(ids.size>=3)for(const id of ids)flag(id,'repeated');
for(const c of cases){
 if(!c.title)flag(c.id,'no title');
 for(const e of c.definition.variants.did.events){const m=String(e.action).match(/\b(\d\d):(\d\d)\b/);if(m&&e.at.slice(11,16)!==m[0])flag(c.id,'clock mismatch')}
 for(const w of c.definition.variants.did.witnesses)if(/여부|경위|범위|일$|사실$/.test(w.role))flag(c.id,'role is a topic');
}
const playable=cases.filter(c=>c.qa?.runtime||c.qa?.fullPlaythrough||c.playable);
for(const c of playable)assert.ok(!problems.has(c.id),c.id+' is marked playable but: '+[...(problems.get(c.id)||[])].join(', '));
const count=p=>[...problems.values()].filter(s=>s.has(p)).length;
const rep=[...owner].filter(([,i])=>i.size>=3).length;
console.log(`Advanced drafts ${cases.length}: playable ${playable.length} · repeated lines ${rep} (in ${count('repeated')} cases) · clock mismatch ${count('clock mismatch')} · topic roles ${count('role is a topic')} · no title ${count('no title')}`);
