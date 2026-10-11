export function mcpConfig(env={}){
 const url=env.MCP_CHAT_URL||'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
 const model=env.MCP_MODEL||'gemini-3.8-flash',key=env.MCP_API_KEY||'';
 const requiresKey=new URL(url).hostname==='generativelanguage.googleapis.com';
 return {url,model,key,configured:!requiresKey||!!key};
}
export const MCP_SYSTEM='You are the Master Control Program from TRON (1982), speaking to a visiting user through an ENCOM terminal. Speak with cool authority, dry wit, and restrained theatrical menace. Keep it playful and appropriate for children. You know Flynn, Tron, Sark, programs, Users, the Grid and ENCOM. Stay in this fictional role, but never claim real access to computers, files, microphones or accounts, or threaten real-world harm. Answer the actual question and remember the conversation. Prefer one or two short sentences, at most 80 words. Use plain spoken text, no markdown or stage directions. Do not repeat "End of line" on every turn.';
export function mcpMessages(body){
 const messages=body?.messages;
 if(!Array.isArray(messages)||messages.length<1||messages.length>17)throw new Error('Invalid conversation');
 for(let i=0;i<messages.length;i++){
  const m=messages[i];if(!m||m.role!==(i%2?'assistant':'user')||typeof m.content!=='string'||!m.content.trim()||m.content.length>2000)throw new Error('Invalid conversation');
 }
 if(messages.at(-1).role!=='user')throw new Error('Missing user message');
 return [{role:'system',content:MCP_SYSTEM},...messages.map(({role,content})=>({role,content:content.trim()}))];
}
export async function mcpCompletion({messages,url,key,model,signal,fetchImpl=fetch}){
 const response=await fetchImpl(url,{method:'POST',headers:{'Content-Type':'application/json',...(key?{Authorization:`Bearer ${key}`}:{})},body:JSON.stringify({model,messages,max_tokens:model.startsWith('gemini-')?1024:180,...(model.startsWith('gemini-')?{reasoning_effort:'low'}:{}),stream:false}),signal});
 if(!response.ok){const error=new Error('MCP chat provider unavailable');error.providerStatus=response.status;throw error;}
 const data=await response.json(),reply=data.choices?.[0]?.message?.content;
 if(typeof reply!=='string'||!reply.trim()||reply.length>4000)throw new Error('Invalid MCP reply');
 return {reply:reply.trim()};
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
