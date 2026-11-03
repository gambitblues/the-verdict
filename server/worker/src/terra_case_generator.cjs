/* THE VERDICT P3-10 — opt-in offline AI case production.
 * Network request only when a caller explicitly invokes generate with a transport.
 * Do not use this from the gameplay/browser Worker routes. All outputs stay drafts.
 */
'use strict';
const {validateDraft}=require('./terra_case_pipeline.cjs');
const {prepareWorldSheet}=require('./terra_world_sheet_handoff.cjs');
const TRUTHS=['did','didnt','reason'];
const CATEGORY=['homicide','sexual','violence','financial','property','reputation','civil','family','professional','public'];
const MAX_OUTPUT=14000;
const short=x=>String(x||'').slice(0,8000);
function parseOutput(data){
 if(typeof data?.output_text==='string'&&data.output_text.trim())return JSON.parse(data.output_text);
 for(const item of data?.output||[])for(const c of item?.content||[])if(c.type==='output_text'&&typeof c.text==='string')return JSON.parse(c.text);
 throw Error('모델이 JSON 문서를 반환하지 않았습니다.');
}
async function requestJSON({fetcher,apiKey,model,instructions,input,maxTokens=MAX_OUTPUT}){
 if(typeof fetcher!=='function')throw Error('AI 호출 함수가 제공되지 않았습니다.');
 if(!apiKey||!model)throw Error('API 키와 모델이 필요합니다.');
 const r=await fetcher('https://api.openai.com/v1/responses',{method:'POST',
  headers:{authorization:'Bearer '+apiKey,'content-type':'application/json'},
  body:JSON.stringify({model,store:false,max_output_tokens:maxTokens,
   instructions,input,text:{format:{type:'json_object'}}})});
 const json=await r.json();
 if(!r.ok)throw Error('AI 제작 요청 실패 ('+r.status+'): '+short(json?.error?.message||'API error').slice(0,260));
 return {object:parseOutput(json),usage:json.usage||null,model:json.model||model};
}
function seedPrompt(seed){
 if(!seed||!CATEGORY.includes(seed.category)||typeof seed.id!=='string'||!/^[a-z][a-z0-9-]{3,79}$/.test(seed.id))throw Error('신규 사건 ID 및 유형이 유효하지 않습니다.');
 if(typeof seed.premise!=='string'||seed.premise.trim().length<20)throw Error('서로 독립적인 사건 소재를 충분히 기술해야 합니다.');
 return {category:seed.category,id:seed.id,premise:seed.premise};
}
const RULES=`THE VERDICT용 독립적인 한국 성인 법정 사건의 제작자다. 한국어로 JSON 객체 하나만 반환한다.
대본이나 요약이 아니라 실제 증거기록에 기반한 공판 가능한 독립 사건을 작성한다.
실존 인물의 식별 정보 및 성폭력의 선정적인 묘사, 범행 실행법을 적지 않는다.
세 개의 서로 다른 잠긴 실제 세계 did/didnt/reason를 설계한다.
진실을 증거와 공개 사건 요지에 누출하지 않는다.
현장 관찰·미확인 사실·증거 원문·증인 관찰 범위를 구체적으로 구분한다.
강간, 폭행, 살인에서는 실제 공간·시간·인과관계·손상 발생 양상의 개연성을 고려하고
상처의 유무만으로 동의·범행을 단정하거나 무죄를 무고로 치환하지 않는다.
상해·DNA·복약·돈의 흐름 등 전문 증거의 출처와 한계를 정확히 설명한다.
판례 번호/출처를 창작하지 않는다. 공식 검증 없이 source.type은 original로만 작성한다.
후일담에서 동일 인물의 사건 진실을 바꾸거나 친자관계를 자동 확정하지 않는다.
placeholder, '원문 확인 필요', 동일한 증거 문장 재활용을 금지한다.`;
function stageOneInput(seed){
 return `다음 소재를 사실과 인물 식별정보 모두 가상으로 제작: ${JSON.stringify(seed)}
반드시 verdict-terra-candidate/v1 JSON으로 반환. status는 draft, source는 {type:"original",note:"..."};
card {kind,category,title,summary}, premise {cause,action,aftermath},
scene {location,observed,uncertainty}, records는 3건 이상(최소 1개 최초 제출, 최소 1개 추후 제출,
각 record에 id,title,kind,how,limitation,first,by);
witnesses는 2명 이상 각 {id:"W1",role,knowledgeLimit}.
worlds.did/didnt/reason 각각 act,motive,cause,timeline:[{at:"HH:MM",what}],records:{각 기록id:"자료 원문"},
witnesses:{각 증인id:"해당 세계 직접 관찰"}를 작성.
realism에 timelineMechanics,physicalScene,evidenceProvenance,witnessObservability,
alternativeHypotheses,aftermathConsequences,sensitiveDetailPolicy:"non-graphic",
그리고 분야별 사실 검증 설명을 작성.
성범죄면 sexualRealism {scenarioType,interaction,consentContext,capacityContext,forceOrPressure,
medicalFindings,medicalLimits,evidenceLimits,aftermath,
worlds:{did:{mechanism,observations,alternativeExplanation},didnt:{...},reason:{...}}} 필수.
모든 설명은 서로 다른 실제 관찰과 사건 사실에 기반하고 충분히 구체적이어야 한다.
출력은 JSON 객체 하나. 원형 ID를 정확히 유지.`;
}
function stageTwoInput(candidate){
 return `다음 후보의 숨긴 세계와 원문을 한 글자도 바꾸지 않고,
verdict-world-sheet/v1 정식 세계 시트 JSON을 완성하라:
${JSON.stringify(candidate)}
필수: format, id, status:"draft", source:{type:"original",note},
card는 후보 kind/category/title/summary 그대로, accused:"A",complainant:"B",
형사 card.charge {name,law,min,max,life,fine}, 민사 claim {amount,fair:[min,max],what},
결정형 decision {what,yes,no};
people A,B,W1... 각각 key,name,role,age,job,state,traits. 성범죄 형사 피고 A는 남성.
places [{id,name}], devices 배열, common {date,timeline:[{at,what,who?,place?}],facts:[]}.
records의 ID/제목/kind/by/how/first는 후보 그대로 보존하고 최초가 아닌 자료는 unlock을 붙인다.
worlds.did/didnt/reason은 후보의 act,motive,cause,records 원문과 witnesses의 관찰을
각 saw로 정확히 이관한다. 각 세계에 label,legal,timeline,knows:{A:"...",B:"..."},
형사 sentencing:{means,degree,count,setting,harm,victim,planning,after}가 필요하다.
traps,screen,open을 추가한다. 법률을 확인할 수 없으면 검증 필요를 open에 명시하고
최종 배당하지 않는다. 결정적 사실을 추측해 덮어쓰지 않는다.
JSON 객체 하나로만 출력.`;
}
async function generate(seed,{fetcher,apiKey,model='gpt-6.1-terra'}={}){
 const chosen=seedPrompt(seed);
 const first=await requestJSON({fetcher,apiKey,model,instructions:RULES,input:stageOneInput(chosen)});
 const candidate=first.object;
 if(candidate.id!==chosen.id||candidate.card?.category!==chosen.category)throw Error('모델이 사건 ID 또는 범주를 변경했습니다.');
 if(candidate.status!=='draft')throw Error('모델의 초안이 draft 상태가 아닙니다.');
 const preliminary=validateDraft(candidate);
 if(!preliminary.ok)return {ok:false,stage:'candidate-QA',errors:preliminary.errors,usage:[first.usage]};
 // Stage-two can only read a reviewed candidate; a generation job must NOT self-approve.
 const reviewedForStructure={...candidate,status:'review'};
 const reviewed=validateDraft(reviewedForStructure);
 if(!reviewed.ok)return {ok:false,stage:'review-readiness',errors:reviewed.errors,usage:[first.usage]};
 const second=await requestJSON({fetcher,apiKey,model,instructions:RULES,input:stageTwoInput(reviewedForStructure)});
 const checked=prepareWorldSheet(reviewedForStructure,second.object);
 if(!checked.ok)return {ok:false,stage:'world-sheet-handoff',errors:checked.errors,usage:[first.usage,second.usage]};
 return {ok:true,stage:'unreviewed-draft',candidate,worldSheet:checked.sheet,
   candidateHash:checked.candidateHash,sheetHash:checked.sheetHash,
   usage:[first.usage,second.usage],model:second.model,
   warning:'실제 운영자 승인·법률 검증·재판 시뮬레이션은 별도로 필요합니다.'};
}
module.exports={generate,parseOutput,requestJSON,seedPrompt,stageOneInput,stageTwoInput,RULES};
