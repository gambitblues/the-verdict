/* THE VERDICT — 1500 deterministic Korean avatar identities. Vector only: no image downloads.
   Fixed seed identity; age/outfits/eyewear do not mutate original NPC or saved state. */
(function(root,factory){const a=factory();if(typeof module==='object'&&module.exports)module.exports=a;if(root)root.VerdictAvatars=a;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const hash=x=>{let h=2166136261;for(const ch of String(x))h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;return h>>>0};
const pick=(h,n,shift=0)=>((h>>>shift)%n);
const skins=['#efcdb7','#e5bda2','#dcae90','#f2d3b9','#c99372','#e9bfa7','#d3a181','#f0c7a6'];
const suit=['#263b52','#394d68','#3c464c','#465968','#654e5c','#273f45','#545066','#364e5b'];
const hair=['#252128','#31272b','#412e2a','#222b32','#54372d','#352b36'];
const fmt=n=>String(n).padStart(3,'0');
function profile(n){if(n<0||n>=1500||!Number.isInteger(n))throw Error('avatar index');
 // Preserve indices 0..499 exactly for pre-existing save compatibility.
 const legacy=n<500,gender=legacy?(n<250?'male':'female'):(n<1000?'male':'female');
 const slot=legacy?n%250:(n<1000?n-500:n-1000);
 const ages=legacy?[30,60,70,60,30]:[60,120,140,120,60];
 let group=0,k=slot;while(k>=ages[group])k-=ages[group++];
 const band=['20s','30s','40s','50s','60s'][group],h=hash('the-verdict-avatar-v1:'+n);
 return Object.freeze({id:'KR-'+(gender==='male'?'M':'F')+'-'+fmt(legacy?slot+1:slot+251),index:n,gender,ageBand:band,face:pick(h,12),eyes:pick(h,9,4),brows:pick(h,7,8),nose:pick(h,8,12),mouth:pick(h,8,16),hair:pick(h,24,3),skin:pick(h,skins.length,9),glasses:pick(h,11,18)===0,facialHair:gender==='male'&&pick(h,7,17)===0,style:pick(h,6,21)});
}
const CATALOG=Object.freeze(Array.from({length:1500},(_,i)=>profile(i)));
function genderOf(person,id){const v=String(person?.gender||'').toLowerCase();if(/여|female|woman/.test(v))return 'female';if(/남|male|man/.test(v))return 'male';if(person?.name&&/[희연윤지수나미아은]/.test(String(person.name).slice(-1)))return 'female';return id==='self'?'male':hash(id)%2?'female':'male'}
function assign(id,person,gender,age){
 const g=gender||genderOf(person,id),band=age<30?0:age<40?1:age<50?2:age<60?3:4;
 const oldStart=g==='female'?250:0,oldOffset=[0,30,90,160,220][band],oldLength=[30,60,70,60,30][band];
 const stableId=String(id||person?.id||person?.name||'unknown');
 // Existing NPC visuals remain deterministic across the 500 -> 1500 catalogue expansion.
 if(!person?.avatarSeedId)return CATALOG[oldStart+oldOffset+hash('npc:'+stableId)%oldLength];
 const fixed=CATALOG.find(s=>s.id===person.avatarSeedId);
 return fixed||CATALOG[oldStart+oldOffset+hash('npc:'+stableId)%oldLength];
}
function assignNew(id,person,age){
 const g=genderOf(person,id),band=age<30?0:age<40?1:age<50?2:age<60?3:4;
 const start=g==='female'?1000:500,offset=[0,60,180,320,440][band],length=[60,120,140,120,60][band];
 return CATALOG[start+offset+hash('npc-new:'+String(id))%length];
}

const safe=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function svg(seed,opts={}){
 const age=Number(opts.age)||45,role=String(opts.role||'civilian'),coat=opts.coat||suit[(seed.index+seed.style)%suit.length];
 const skin=skins[seed.skin],ink=hair[(seed.hair+seed.style)%hair.length],aging=Math.max(0,Math.min(.7,(age-35)/58));
 const glasses=opts.glasses===true||(opts.glasses!==false&&seed.glasses);
 const style=opts.hairIndex??seed.hair;
 const fringe=style%4===0?'M25 52Q17 13 54 16Q88 11 87 49Q72 33 57 29Q37 28 25 52Z':style%4===1?'M25 56Q16 18 55 17Q88 12 88 51Q74 35 65 33Q43 39 25 56Z':style%4===2?'M23 51Q15 16 51 14Q90 13 91 51L86 70Q81 39 67 34Q42 25 23 51Z':'M23 49Q19 15 51 17Q82 8 90 49Q73 29 56 35Q41 26 23 49Z';
 const longHair=seed.gender==='female'?'<path d="M22 38Q9 61 19 112L33 104L34 48ZM90 38Q102 61 94 112L80 104L79 48Z" fill="'+ink+'"/>':'';
 const wrinkles=age>=40?'<g fill="none" stroke="#896854" stroke-width=".9" opacity="'+aging.toFixed(2)+'"><path d="M29 55q7-4 14 0M70 55q7-4 14 0M44 83q12 5 24 0M35 70q-7 5-2 12M79 70q7 5 2 12"/></g>':'';
 const gray=age>=55?'<path d="'+fringe+'" fill="none" stroke="#bbb3a8" stroke-width="'+Math.min(4,(age-50)/7)+'" opacity=".5"/>':'';
 const outfit=role==='judge'?'<path d="M28 98Q15 99 13 150H99Q97 98 83 98L74 105L57 117L39 105Z" fill="#212a34"/><path d="M47 101L56 119L65 101" fill="none" stroke="#e1e5e9" stroke-width="4"/>':role==='doctor'?'<path d="M29 99L41 102L56 125L70 102L84 99L95 150H17Z" fill="#eff1ee"/>':null;
 const eyesY=60+(seed.eyes%3),spread=16+(seed.face%4),eyebrow=seed.brows%4;
 return '<svg viewBox="0 0 112 175" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="캐릭터 초상화"><rect width="112" height="175" rx="12" fill="#e3e8e8"/><path d="M0 131Q56 107 112 132V175H0Z" fill="#c2cbd0"/><path d="M20 150Q20 105 44 101H68Q92 105 92 150V175H20Z" fill="'+safe(coat)+'"/><path d="M44 100L56 124L68 100" fill="#f5f5f1"/><path d="M56 112L49 119L55 144L62 119Z" fill="#8b6d63"/><path d="M48 84H65V110H48Z" fill="'+skin+'"/>'+longHair+'<ellipse cx="56" cy="56" rx="'+(31+seed.face%5)+'" ry="'+(41+seed.face%4)+'" fill="'+skin+'"/><ellipse cx="23" cy="67" rx="5" ry="9" fill="'+skin+'"/><ellipse cx="89" cy="67" rx="5" ry="9" fill="'+skin+'"/><path d="'+fringe+'" fill="'+ink+'"/>'+gray+'<g fill="none" stroke="'+ink+'" stroke-linecap="round" stroke-width="'+(1.8+eyebrow*.22)+'"><path d="M'+(56-spread-7)+' '+(eyesY-8)+'q6 -'+(2+eyebrow)+' 12 0M'+(56+spread-5)+' '+(eyesY-8)+'q6 -'+(2+eyebrow)+' 12 0"/></g><g fill="#29343c"><ellipse cx="'+(56-spread)+'" cy="'+eyesY+'" rx="'+(2.2+seed.eyes%3*.2)+'" ry="3"/><ellipse cx="'+(56+spread)+'" cy="'+eyesY+'" rx="'+(2.2+seed.eyes%3*.2)+'" ry="3"/></g><path d="M56 62q'+(seed.nose%5-2)+' 7 -1 10q3 2 6 0" fill="none" stroke="#a87f69" stroke-width="1.4"/><path d="M'+(48-seed.mouth%3)+' 83q'+(8+seed.mouth%3)+' '+(seed.mouth%2?4:2)+' '+(17+seed.mouth%3)+' 0" fill="none" stroke="#a36b6a" stroke-width="1.6"/>'+wrinkles+(seed.facialHair?'<path d="M34 83q22 21 44 0q-8 26-22 25q-14 0-22-25" fill="'+ink+'" opacity=".48"/>':'')+(glasses?'<g fill="none" stroke="#3f4d57" stroke-width="1.9"><rect x="27" y="'+(eyesY-6)+'" width="23" height="15" rx="5"/><rect x="62" y="'+(eyesY-6)+'" width="23" height="15" rx="5"/><path d="M50 '+eyesY+'h12M27 '+eyesY+'l-7-2M85 '+eyesY+'l7-2"/></g>':'')+(outfit||'')+'</svg>';
}
function render(id,person,opts={}){const age=Number(opts.age)||45,seed=assign(id,person,opts.gender,age);return '<span class="avatar avatar-v2" data-avatar-seed="'+seed.id+'" aria-hidden="true">'+svg(seed,opts)+'</span>'}
return Object.freeze({CATALOG,profile,assign,assignNew,svg,render,staticImageBytes:0});
});
