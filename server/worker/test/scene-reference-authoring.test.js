import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

function load(path,exportName){
 const file=fileURLToPath(new URL('../../../'+path,import.meta.url)),ctx={};
 vm.runInNewContext(readFileSync(file,'utf8')+';this.__value='+exportName+';',ctx,{filename:file});
 return ctx.__value;
}
const Pack=load('case_pack_engine.js','CasePackEngine');
const Story=load('story_engine.js','StoryEngine');
function archetype(){
 return {id:'fictional-homicide-001',category:'homicide',baseKey:'murder',kind:'criminal',
  tag:'형사·살인',icon:'⚖',importance:5,legal:'살인죄 구성요건',title:'오래된 주택에서 발견된 사망자',
  premise:'오래된 다세대주택에서 사람이 숨진 채 발견됐다.',
  trigger:'새벽에 이웃이 이상한 소리를 듣고 신고했다.',
  motive:'금전 문제로 다툰 관계가 있었다.',relationship:'오래 알고 지낸 이웃',
  incident:{cause:'오래된 금전 문제로 다툼이 있었다.',action:'사망 현장 주변에서 여러 출입 기록이 발견됐다.',
   aftermath:'수사기관은 기록이 가리키는 시각과 목격자 진술을 비교했다.'},
  scene:{location:'낡은 다세대주택 거실',observed:'바닥 타일에 혈흔이 남아 있었고 깨진 유리컵이 식탁 옆에 놓여 있었다.',
   uncertainty:'혈흔과 유리컵이 누구의 어떤 행동으로 생겼는지는 조사로 확인해야 한다.'},
  evidence:[
   {title:'현장 감식서',proves:'현장에서 발견된 흔적',limitation:'흔적만으로 행위자를 특정할 수 없다.'},
   {title:'출입구 영상기록',proves:'출입 시간대',limitation:'카메라 사각지대가 존재한다.'},
   {title:'이웃 진술 기록',proves:'당일 소리와 시간대',limitation:'목격자가 인물을 직접 보지는 못했다.'}
  ],questions:['목격한 소리와 시각 확인','현장 출입 시간 검토','감식 결과의 한계 대조'],
  causalTags:['주거지 출입','사망 경위','간접 목격'],
  references:[{type:'precedent',title:'공개 판례 검토를 위한 가상 예시 메타데이터',
   url:'https://open.law.go.kr/LSO/openApi/guideList.do',publisher:'국가법령정보 공동활용',
   published:'2026-11-04',learning:'관찰된 사실과 행위자 특정은 별도로 판단해야 한다.'}]
 };
}
const pack=a=>({format:Pack.format,packId:'scene-source-example',version:'1.0.0',title:'검증용 사건 원형',archetypes:[a]});
test('source metadata and specific physical scene survive pack validation and blueprint',()=>{
 const a=archetype(),check=Pack.validate(pack(a));
 assert.equal(check.ok,true,check.errors?.join(', '));
 const b=Pack.blueprint(pack(a),a);
 assert.equal(b.packOrigin.scene.location,'낡은 다세대주택 거실');
 assert.equal(b.packOrigin.references.length,1);
});
test('new scene stays part of record, while truth and proof are derived independently',()=>{
 const a=archetype(),bp=Pack.blueprint(pack(a),a);
 function make(){
  let n=0;const people={prosecutor:{name:'검사',role:'검사'},counsel:{name:'변호인',role:'변호사'}};
  const createNPC=role=>{const id='p'+(++n);people[id]={name:'허구'+n,role,wealth:45};return id};
  return Story.build({caseId:'new-fiction',blueprint:bp,instance:0,loc:'서울 성북구',now:'2028.03.01',week:100,
   r:()=>.4,makeNPC:createNPC,prosecutorPool:['prosecutor'],counselPool:['counsel'],people});
 }
 const c=make();
 assert.equal(c.qa.pass,true,c.qa.errors?.join(', '));
 assert.match(c.intro,/혈흔/);
 assert.match(c.intro,/누구의 어떤 행동/);
 assert.equal(c.story.scene.location,c.story.place);
 assert.equal(c.story.privateTruth.kind,'partial');
 assert.ok(c.story.proofStrength>=0&&c.story.proofStrength<=1);
 assert.equal(c.story.pack.referenceCount,1);
});
test('invalid or maliciously shaped source information fails closed',()=>{
 const a=archetype();
 a.references[0].url='javascript:alert(1)';
 assert.equal(Pack.validate(pack(a)).ok,false);
 const b=archetype();b.scene.uncertainty='';
 assert.equal(Pack.validate(pack(b)).ok,false);
 const c=archetype();c.references[0].learning='';assert.equal(Pack.validate(pack(c)).ok,false);
});
