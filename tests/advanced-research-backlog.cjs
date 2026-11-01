/* Audits existing 100 editorial scenarios as a source RESEARCH backlog.
 * They are not verified judgments nor 100 completed Advanced cases.
 */
const fs=require('node:fs'),path=require('node:path');
const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../content-packs/court-editorial-100-v1.json'),'utf8'));
const byKind={};for(const c of pack.cases)byKind[c.kind]=(byKind[c.kind]||0)+1;
const wishlist={criminal:50,civil:25,family:20,administrative:5};
const output={
 generatedAt:'not tracked (static script)',
 status:'research_backlog_not_advanced',
 note:'Existing editorial case ideas; NOT validated source judgments. This is not the target 50/25/20/5 catalogue.',
 existing:pack.cases.length,byKind,target:wishlist,
 items:pack.cases.map((c,i)=>({ordinal:i+1,legacyId:c.id,title:c.title,legacyKind:c.kind,
  researchStatus:'unverified',sourceJudgment:null,sourceArticle:null,sourceDate:null,
  verifiedLegalArticle:null,fictionalizedNarrative:null,advancedDataStatus:'not_started',qaStatus:'not_started'}))
};
if(require.main===module){process.stdout.write(JSON.stringify(output,null,2)+'\n')}
module.exports=output;
