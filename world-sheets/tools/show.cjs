/* Print what a curated case already says (for writing its hand file). node world-sheets/tools/show.cjs <id> */
const fs=require('fs'),path=require('path');global.window={};eval(fs.readFileSync(path.join(__dirname,'..','..','curated_cases.js'),'utf8'));
const c=window.VerdictCurated.cases[process.argv[2]];
const out={title:c.title,summary:c.summary,charge:c.charge,claim:c.claim,decision:c.decision&&{what:c.decision.what},people:c.people,profile:c.profile,sex:c.sex,truth:c.truth,claims:c.claims,
 evidence:c.evidence.map(e=>({t:e.title,kind:e.kind,by:e.by,when:e.when,ex:e.excerpt,how:e.how,caveat:e.caveat})),
 witnesses:c.witnesses.map(w=>({role:w.role,story:w.story,stake:w.stake,says:w.says,q:(w.q||[]).map(q=>[q.q,q.a])})),
 follow:(c.followUps||[]).map(f=>({id:f.id,type:f.type,ask:f.ask,ev:f.evidence&&{t:f.evidence.title,ex:f.evidence.excerpt,by:f.evidence.by},w:f.witness&&{role:f.witness.role,says:f.witness.says,q:(f.witness.q||[]).map(q=>q.a)},none:f.none})),
 party:c.party?.q?.map(q=>[q.q,q.a]),late:c.late&&{t:c.late.title,ex:c.late.excerpt},endings:c.endings};
console.log(JSON.stringify(out,null,0));
