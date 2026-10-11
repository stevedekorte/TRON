import {mcpMessages,mcpCompletion,mcpConfig,mcpError} from '../../shared/mcp-chat.js';
export async function mcpRoute(request,env,ctx,{send,boundedJson,clientHash,fetchImpl}){
 const {url,key,model}=mcpConfig(env);
 const configured=env.MCP_ENABLED==='true'&&!!key;
 if(new URL(request.url).pathname==='/api/mcp/status'&&request.method==='GET')return send(200,{configured});
 if(new URL(request.url).pathname!=='/api/mcp/chat'||request.method!=='POST')return send(405,{error:'Method not allowed'});
 if(!configured)return send(503,{error:'MCP CHAT SERVICE NOT CONFIGURED'});
 const ip=request.headers.get('CF-Connecting-IP');if(!ip)return send(403,{error:'Missing client identity'});
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return send(415,{error:'JSON required'});
 let messages;try{messages=mcpMessages(await boundedJson(request));}catch{return send(400,{error:'Invalid conversation'});}
 let budget,lease;
 try{
  const client=await clientHash(ip,env.MCP_API_KEY);
  budget=env.JEV_BUDGET.get(env.JEV_BUDGET.idFromName('global'));
  const reservation=await budget.fetch('https://budget/reserve',{method:'POST',body:JSON.stringify({client,bytes:new TextEncoder().encode(JSON.stringify(messages)).length})});
  if(!reservation.ok)throw new Error();const result=await reservation.json();
  if(!result.ok)return send(429,{error:'MCP BUSY — TRY AGAIN',retryAfter:result.retryAfter});
  lease=result.lease;
  return send(200,await mcpCompletion({messages,url,key,model,signal:AbortSignal.timeout(45000),fetchImpl}));
 }catch(error){const failure=mcpError(error);return send(failure.status,{error:failure.message});}
 finally{if(lease)ctx.waitUntil(budget.fetch('https://budget/release',{method:'POST',body:JSON.stringify({lease})}).catch(()=>{}));}
}
