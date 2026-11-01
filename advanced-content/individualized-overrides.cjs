/* Author-led overrides for five differentiated Advanced drafts.
 * The canonical case engine still controls truth locks and court-history.
 * The other 94 cases remain template-generated and are not certified.
 */
const base=require('./expand-99.cjs');
const authored=require('./individually-authored-005.json');
const clone=x=>JSON.parse(JSON.stringify(x));
function merge(item,record){
 const c=clone(item), e=c.definition.variants;
 c.title=record.title;c.fictionalLocation=record.place;c.pleading={kind:item.category==='criminal'?'공소장 요지':'소장 요지',allegations:[record.document],issue:record.fight[0]};
 c.participants=record.people;
 c.authoredRecord=clone(record);
 const tkeys=['did','didnt','reason'];
 for(const [n,t] of tkeys.entries()){
  const v=e[t];
  v.events[0].action=record.facts[0];
  v.events[1].action=record.truth[n];
  v.events[2].action=record.facts[record.facts.length-1];
  for(let j=0;j<Math.min(v.evidence.length,record.evidence.length);j++){
   v.evidence[j].kind=record.evidence[j][0];
   v.evidence[j].excerpt=record.evidence[j][1];
  }
  for(let w=0;w<Math.min(2,v.witnesses.length);w++){
   const s=v.witnesses[w].script;
   s.opening.prompt=record.questions[w][0];
   s.opening.responses.initial.text=record.questions[w][1];
   s.opening.responses.confront.text=record.questions[w][2];
   s.specifics.prompt=record.questions[w][0];
   s.specifics.responses.initial.text=record.questions[w][1];
   s.clock.responses.confront.text=record.questions[w][2];
  }
 }
 c.manifest.records.forEach((r,i)=>r.kind=record.evidence[i][0]);
 const lines=c.dialogue.lines;
 lines[0].text=record.questions[0][0];
 lines[1].text=record.questions[0][1];
 lines[2].text=record.fight[0];
 lines[3].text=record.questions[0][2];
 lines[4].text=record.fight[1];
 lines[5].text=record.fight[2];
 c.qa.individualizedAuthorship=true;
 c.qa.fullPlaythrough=false;c.qa.runtime=false;
 return c;
}
const edited=new Map(authored.cases.map(x=>[x.id,x]));
const result={format:'advanced-99-hybrid/v1',cases:base.cases.map(c=>edited.has(c.id)?merge(c,edited.get(c.id)):c)};
if(require.main===module)console.log(JSON.stringify({total:result.cases.length,individuallyAuthored:result.cases.filter(c=>c.qa.individualizedAuthorship).length,remaining:result.cases.filter(c=>!c.qa.individualizedAuthorship).length}));
module.exports=result;
