/* Advanced case content QA contract. No placeholder case can ship as a verified case. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.VerdictAdvancedSchema=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const kinds={criminal:50,civil:25,family:20,administrative:5};
const required=['id','kind','title','source','fictionalPlace','allegation','legal','participants','variants','manifest','dialogue','worldHooks'];
function validate(x){
 if(!x||typeof x!=='object')throw Error('case required');
 for(const k of required)if(x[k]===undefined||x[k]===null)throw Error('Missing '+k);
 if(!Object.hasOwn(kinds,x.kind))throw Error('kind invalid');
 if(typeof x.fictionalPlace!=='string'||x.fictionalPlace.length<6)throw Error('specific fictional place required');
 if(x.source.type==='original_fiction'){if(x.source.realCaseVerified!==false)throw Error('Original fiction cannot masquerade as verified case');}
 else if(!x.source.url||!/^https:\/\//.test(x.source.url)||!x.source.verified||!x.source.caseNumber)throw Error('Verified judgment source required');
 if(!x.legal.statute||!x.legal.article||!x.legal.effectiveDate)throw Error('applicable law missing');
 if(!Array.isArray(x.participants)||x.participants.length<2)throw Error('participants required');
 for(const t of ['did','didnt','reason']){
 const v=x.variants[t];if(!v)throw Error('Missing truth '+t);
 if(!Array.isArray(v.events)||v.events.length<3||!Array.isArray(v.evidence)||!v.evidence.length||!Array.isArray(v.witnesses)||!v.witnesses.length)throw Error('Incomplete truth '+t);
 const e=new Set(v.events.map(a=>a.id));if(e.size!==v.events.length)throw Error('duplicate events');
 for(const ev of v.events)if(!ev.at||!ev.place||!ev.action)throw Error('event lacks specifics');
 for(const w of v.witnesses){if(!Array.isArray(w.observedEventIds)||w.observedEventIds.some(id=>!e.has(id)))throw Error('impossible witness observation');}
 }
 return true;
}
function catalogue(cases){
 const ids=new Set(),count={criminal:0,civil:0,family:0,administrative:0};
 for(const c of cases){validate(c);if(ids.has(c.id))throw Error('duplicate case');ids.add(c.id);count[c.kind]++;}
 if(cases.length!==100||Object.keys(kinds).some(k=>count[k]!==kinds[k]))throw Error('100-case category mix not complete');
 return {count,validated:cases.length};
}
return Object.freeze({validate,catalogue,kinds});
});
