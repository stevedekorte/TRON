import {mcpSpeech,speechText,MCP_SPEECH} from '../shared/mcp-speech.js';
import {readFileSync} from 'node:fs';
import {mcpMessages,mcpCompletion,mcpConfig,mcpError} from '../shared/mcp-chat.js';
export function createMcpMiddleware(env={},fetchImpl=fetch){
 let busy=false;
 return async(req,res,next)=>{
  if(!['/api/mcp/status','/api/mcp/chat','/api/mcp/voice-status','/api/mcp/speech'].includes(req.url))return next();
  const settings=typeof env==='function'?env():env;
  const {url,key,model,configured}=mcpConfig(settings);
  const speech=req.url==='/api/mcp/speech';
  const send=(code,data)=>{if(!res.writableEnded){res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}};
  try{if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return send(403,{error:'Origin rejected'});}catch{return send(403,{error:'Origin rejected'});}
  if(req.url==='/api/mcp/voice-status'&&req.method==='GET')return send(200,{configured:!!settings.FAL_KEY});
  if(req.url==='/api/mcp/status'&&req.method==='GET')return send(200,{configured});
  if((req.url!=='/api/mcp/chat'&&!speech)||req.method!=='POST')return send(405,{error:'Method not allowed'});
  if(speech?!settings.FAL_KEY:!configured)return send(503,{error:'MCP CHAT SERVICE NOT CONFIGURED'});
  if(busy)return send(429,{error:'MCP IS PROCESSING ANOTHER REQUEST — TRY AGAIN'});
  let messages;
  try{let body='',bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>24000)return send(413,{error:'Message too large'});body+=chunk;}messages=speech?speechText(JSON.parse(body)):mcpMessages(JSON.parse(body));}catch{return send(400,{error:'Invalid conversation'});}
  if(busy)return send(429,{error:'MCP IS PROCESSING ANOTHER REQUEST — TRY AGAIN'});
  busy=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),speech?MCP_SPEECH.timeoutMs:45000);
  const abort=()=>controller.abort();res.on('close',abort);
  try{send(200,speech?await mcpSpeech({text:messages,key:settings.FAL_KEY,signal:controller.signal,fetchImpl}):await mcpCompletion({messages,url,key,model,searchKey:settings.BRAVE_SEARCH_API_KEY,signal:controller.signal,fetchImpl}));}
  catch(error){console.warn('MCP upstream request failed',{kind:error.name,providerStatus:error.providerStatus,cause:error.cause?.code});const failure=speech?{status:502,message:'MCP CLONED VOICE UNAVAILABLE'}:mcpError(error);send(failure.status,{error:failure.message});}
  finally{busy=false;clearTimeout(timer);res.off('close',abort);}
 };
}
export function mcpPlugin(env){
 const currentConfig=()=>{
  let key=env.MCP_API_KEY;
  if(!key){try{const stored=readFileSync(new URL('../credentials/Gemini.txt',import.meta.url));if(!stored.subarray(0,10).equals(Buffer.from('\0GITCRYPT\0')))key=stored.toString('utf8').trim();}catch{}}
  let falKey=env.FAL_KEY;
  if(!falKey){try{const stored=readFileSync(new URL('../credentials/Fal.txt',import.meta.url));if(!stored.subarray(0,10).equals(Buffer.from('\0GITCRYPT\0')))falKey=stored.toString('utf8').trim();}catch{}}
  let searchKey=env.BRAVE_SEARCH_API_KEY;
  if(!searchKey){try{const stored=readFileSync(new URL('../credentials/BRAVE_SEARCH_API_KEY.txt',import.meta.url));if(!stored.subarray(0,10).equals(Buffer.from('\0GITCRYPT\0')))searchKey=stored.toString('utf8').trim();}catch{}}
  return {...env,MCP_API_KEY:key,FAL_KEY:falKey,BRAVE_SEARCH_API_KEY:searchKey};
 };
 // Read the local credential on each request so a key replacement takes effect
 // without restarting a long-lived Vite session. Keep one shared busy guard.
 const middleware=createMcpMiddleware(currentConfig);return {name:'mcp-chat',configureServer(server){server.middlewares.use(middleware);},configurePreviewServer(server){server.middlewares.use(middleware);}};
}
