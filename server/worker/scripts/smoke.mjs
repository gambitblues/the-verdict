/* First real test against the deployed Worker: one article and one witness answer.
 * Usage (from server/worker):
 *   VERDICT_API=https://the-verdict-api.<account>.workers.dev \
 *   SUPABASE_URL=https://<project>.supabase.co SUPABASE_ANON_KEY=<anon key> \
 *   VERDICT_EMAIL=<invited email> VERDICT_PASSWORD=<password> node scripts/smoke.mjs
 * Prints which models the key can use, the two generated texts, tokens and estimated cost. */
const {VERDICT_API,SUPABASE_URL,SUPABASE_ANON_KEY,VERDICT_EMAIL,VERDICT_PASSWORD}=process.env;
for(const [k,v] of Object.entries({VERDICT_API,SUPABASE_URL,SUPABASE_ANON_KEY,VERDICT_EMAIL,VERDICT_PASSWORD}))if(!v){console.error('missing env '+k);process.exit(1)}

const login=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:SUPABASE_ANON_KEY,'content-type':'application/json'},body:JSON.stringify({email:VERDICT_EMAIL,password:VERDICT_PASSWORD})});
const session=await login.json();if(!login.ok){console.error('login failed',session);process.exit(1)}
const call=async(path,body)=>{const r=await fetch(VERDICT_API+path,{method:body?'POST':'GET',headers:{authorization:`Bearer ${session.access_token}`,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}};

console.log('1) models:',JSON.stringify((await call('/ai/check')).data));
console.log('   no token →',(await fetch(VERDICT_API+'/ai/npc',{method:'POST',body:'{}'})).status,'(expect 401)');

const art=await call('/ai/article',{outlet:'법조일보',reporter:'한지수',style:'사실 위주, 짧은 문장',lean:'p',phase:'before',caseName:'친목 모임의 공동투자금',
 title:'동창 돈 3억, 7천만 원은 어디로',body:'동창 12명이 모은 3억 원 가운데 7천만 원이 개업 엿새 만에 빚 갚는 데 쓰였다. 검찰은 처음부터 속일 생각이었다고 본다. 피고인은 사업을 살리려 했다고 말한다.'});
console.log('2) article:',art.status,JSON.stringify(art.data,null,1));

const npc=await call('/ai/npc',{role:'카페 매니저',years:'개업부터 폐업까지',attitude:'honest',question:'그날 현금은 어떻게 처리했습니까?',answer:'매일 밤 10시에 대표님이 현금을 직접 가져갔어요. 3천만 원쯤 됐을 거예요.'});
console.log('3) witness answer:',npc.status,JSON.stringify(npc.data,null,1));
console.log('4) usage today:',JSON.stringify((await call('/ai/usage')).data));
