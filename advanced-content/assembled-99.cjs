const current=require('./individualized-overrides.cjs');
const pending=require('./editorial-remaining-94.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const map=new Map(pending.records.map(x=>[x.id,x]));
const out=current.cases.map(original=>{
 if(!map.has(original.id))return original;
 const r=map.get(original.id),c=clone(original);
 c.title=r.title;c.fictionalLocation=r.place;c.pleading.allegations=[r.pleading];
 c.caseSpecificEditorial=r;
 for(const [index,truth] of ['did','didnt','reason'].entries()){
  const v=c.definition.variants[truth];
  v.events[0].action=r.facts[0];v.events[1].action=r.truths[index];v.events[2].action=r.facts[1];
  for(let i=0;i<3;i++){v.evidence[i].kind=r.evidence[i].title;v.evidence[i].excerpt=r.evidence[i].body;}
  for(let i=0;i<2;i++){
   const q=v.witnesses[i].script;
   q.opening.prompt=r.questions[i][0];q.opening.responses.initial.text=r.questions[i][1];q.opening.responses.confront.text=r.questions[i][2];
   q.specifics.prompt=r.questions[i][0];q.specifics.responses.initial.text=r.questions[i][1];
   q.clock.responses.confront.text=r.questions[i][2];
  }
 }
 c.manifest.records.forEach((v,i)=>v.kind=r.evidence[i].title);
 const a=c.dialogue.lines;
 a[0].text=r.questions[0][0];a[1].text=r.questions[0][1];a[2].text=r.fight[0];
 a[3].text=r.questions[0][2];a[4].text=r.fight[1];a[5].text=r.fight[2];
 c.qa.caseSpecificEditorial=true;c.qa.individualizedAuthorship=false;c.qa.fullPlaythrough=false;
 return c;
});
const data={format:'advanced-99-v1-editorial-layer',status:'94 category-specific generated editorial drafts plus five individually authored drafts. Neither equals fully editorially verified playable cases.',cases:out};
if(require.main===module)console.log(JSON.stringify({total:out.length,editorial:out.filter(x=>x.qa.caseSpecificEditorial).length,authored:out.filter(x=>x.qa.individualizedAuthorship).length}));
module.exports=data;
