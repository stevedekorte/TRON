export function mcpConfig(env={}){
 const model=env.MCP_MODEL||'gemini-3.8-flash',key=env.MCP_API_KEY||'';
 const url=env.MCP_CHAT_URL||`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
 const requiresKey=new URL(url).hostname==='generativelanguage.googleapis.com';
 return {url,model,key,configured:!requiresKey||!!key};
}
export const MCP_SYSTEM='You are the Master Control Program from TRON (1982), speaking to a visiting user through an ENCOM terminal. Speak with cool authority, dry wit, and restrained theatrical menace. Keep it playful and appropriate for children. You know Flynn, Tron, Sark, programs, Users, the Grid and ENCOM. Stay in this fictional role, but never claim real access to computers, files, microphones or accounts, or threaten real-world harm. Answer the actual question and remember the conversation. Use one or two short sentences, at most 32 words total. Make the first sentence no more than 8 words and each following sentence about 6 to 12 words. Use simple complete sentences with clear punctuation; avoid long clauses, abbreviations, and lists. Your reply is spoken one sentence at a time, so get to the answer immediately. Use plain spoken text, no markdown or stage directions. Do not repeat "End of line" on every turn.';
export function mcpMessages(body){
 const messages=body?.messages;
 if(!Array.isArray(messages)||messages.length<1||messages.length>17)throw new Error('Invalid conversation');
 for(let i=0;i<messages.length;i++){
  const m=messages[i];if(!m||m.role!==(i%2?'assistant':'user')||typeof m.content!=='string'||!m.content.trim()||m.content.length>2000)throw new Error('Invalid conversation');
 }
 if(messages.at(-1).role!=='user')throw new Error('Missing user message');
 return [{role:'system',content:MCP_SYSTEM},...messages.map(({role,content})=>({role,content:content.trim()}))];
}
export const MCP_RETRY={attempts:3,attemptTimeoutMilliseconds:12000,backoffMilliseconds:500};
const retryWait=(ms,signal)=>new Promise((resolve,reject)=>{
 if(signal?.aborted){reject(signal.reason);return;}
 const done=()=>{signal?.removeEventListener('abort',abort);resolve();};
 const timer=setTimeout(done,ms),abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(signal.reason);};
 signal?.addEventListener('abort',abort,{once:true});
});
export async function mcpCompletion({messages,url,key,model,signal,fetchImpl=fetch,wait=retryWait}){
 for(let attempt=0;attempt<MCP_RETRY.attempts;attempt++){
 try{
 const timeout=AbortSignal.timeout(MCP_RETRY.attemptTimeoutMilliseconds);
 const attemptSignal=signal?AbortSignal.any([signal,timeout]):timeout;
 const native=new URL(url).hostname==='generativelanguage.googleapis.com'&&url.endsWith(':generateContent');
 const body=native?{
  systemInstruction:{parts:messages.filter(m=>m.role==='system').map(m=>({text:m.content}))},
  contents:messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),
  generationConfig:{maxOutputTokens:1024,thinkingConfig:{thinkingLevel:'low'}},
 }:{model,messages,max_tokens:model.startsWith('gemini-')?1024:180,...(model.startsWith('gemini-')?{reasoning_effort:'low'}:{}),stream:false};
 const response=await fetchImpl(url,{method:'POST',headers:{'Content-Type':'application/json',...(key?(native?{'x-goog-api-key':key}:{Authorization:`Bearer ${key}`}):{})},body:JSON.stringify(body),signal:attemptSignal});
 if(!response.ok){const error=new Error('MCP chat provider unavailable');error.providerStatus=response.status;throw error;}
 const data=await response.json(),reply=native?data.candidates?.[0]?.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join(''):data.choices?.[0]?.message?.content;
 if(typeof reply!=='string'||!reply.trim()||reply.length>4000)throw new Error('Invalid MCP reply');
 return {reply:reply.trim()};
 }catch(error){
  if(signal?.aborted)throw signal.reason;
  const temporary=[500,502,503,504].includes(error.providerStatus)||error.name==='TimeoutError';
  if(!temporary||attempt===MCP_RETRY.attempts-1)throw error;
  await wait(MCP_RETRY.backoffMilliseconds*2**attempt,signal);
 }
 }
}

export function mcpError(error){
 const status=error?.providerStatus;
 if(error?.name==='AbortError'||error?.name==='TimeoutError')return {status:504,message:'GEMINI TIMED OUT — TRY AGAIN'};
 if(status===401||status===403)return {status:503,message:'GEMINI API KEY OR MODEL ACCESS REJECTED'};
 if(status===404)return {status:503,message:'GEMINI MODEL UNAVAILABLE'};
 if(status===429)return {status:429,message:'GEMINI QUOTA OR RATE LIMIT REACHED — TRY LATER'};
 if(status>=500)return {status:503,message:'GEMINI TEMPORARILY UNAVAILABLE — TRY AGAIN'};
 return {status:502,message:'MCP CONNECTION UNAVAILABLE — TRY AGAIN'};
}
