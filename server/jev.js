import {readFileSync} from 'node:fs';
// Local development/preview bridge. Secrets never enter Vite's client defines.
export const JEV_LIMITS=Object.freeze({bodyBytes:65536,intervalMs:600,timeoutMs:2200,hourlyRequests:1200});
export function jevQuestion(snapshot,model='jev-latest'){
 const options=snapshot?.options;
 if(!snapshot?.self||!Array.isArray(options)||options.length<1||options.length>12||new Set(options.map(o=>o.id)).size!==options.length)throw new Error('Invalid maneuver set');
 for(const o of options)if(!/^m\d{1,2}$/.test(o.id)||typeof o.kind!=='string'||o.kind.length>32||!Number.isFinite(o.goal?.x)||!Number.isFinite(o.goal?.s))throw new Error('Invalid maneuver');
 return {model,state:JSON.stringify(snapshot),questions:{maneuver:{type:'choice',instructions:'Control this enemy vehicle in the TRON maze. Choose one supplied maneuver, using only the recorded observations and their age. Sound reports are uncertain, amplitude-derived estimates, not confirmed target sightings. Investigate unknown sounds without assuming their source is Clu; friendly sounds are context. A healthy unit losing sight should promptly search the last-known path and plausible branches rather than stop, retreat or wait for the target to reappear. Prefer survival, useful positioning and coordination over crowding or repeated blocked attacks. Wounded units should disengage or regroup. Exploit feasible low approaches and wall-side strike orientations when a fresh sighting makes a strike plausible. A stale sighting is not a live target. The routes are geometrically checked but moving targets can invalidate them. Commit to a useful maneuver; do not oscillate. Output its option ID.',criteria:Object.fromEntries(options.map(o=>[o.id,JSON.stringify({maneuver:o.kind,destination:o.goal,route:o.route,localScore:o.localScore})]))}}};
}
export function createJevMiddleware({apiKey='',model='jev-latest',fetchImpl=fetch,clock=()=>Date.now(),limits=JEV_LIMITS}={}){
 let busy=false,last=-Infinity,hourStart=clock(),count=0;
 return async(req,res,next)=>{
  if(!['/api/jev/status','/api/jev/decision'].includes(req.url?.split('?')[0]))return next();
  const send=(status,value)=>{if(!res.writableEnded){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}};
  // Same-origin local use only; no permissive cross-origin key relay.
  try{if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return send(403,{error:'Origin rejected'});}catch{return send(403,{error:'Origin rejected'});}
  if(req.method==='GET'&&req.url==='/api/jev/status')return send(200,{configured:!!apiKey,model,remaining:Math.max(0,limits.hourlyRequests-count)});
  if(req.method!=='POST'||req.url!=='/api/jev/decision')return send(405,{error:'Method not allowed'});
  if(!apiKey)return send(503,{error:'No TYPESAFE_API_KEY configured; using local planner'});
  const now=clock();if(now-hourStart>=3600000){hourStart=now;count=0;}
  if(busy||now-last<limits.intervalMs||count>=limits.hourlyRequests)return send(429,{error:'Local request limit reached; using local planner'});
  busy=true;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),limits.timeoutMs);
  const abort=()=>{if(!res.writableEnded)controller.abort();};res.on('close',abort);
  try{
   let body='',bytes=0;
   for await(const chunk of req){bytes+=chunk.length;if(bytes>limits.bodyBytes){send(413,{error:'State too large'});return;}body+=chunk;}
   let payload;try{payload=jevQuestion(JSON.parse(body),model);}catch{return send(400,{error:'Invalid state or maneuver set'});}
   last=clock();count++;
   const upstream=await fetchImpl('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
   if(!upstream.ok)return send(502,{error:`Jev returned HTTP ${upstream.status}; using local planner`});
   const data=await upstream.json(),answer=data.answers?.maneuver;
   if(!Object.hasOwn(payload.questions.maneuver.criteria,answer?.choice)||!Number.isFinite(answer?.confidence)||answer.confidence<0||answer.confidence>1)return send(502,{error:'Invalid Jev answer; using local planner'});
   send(200,{id:answer.choice,confidence:answer.confidence,probabilities:answer.probabilities||{},usage:data.usage||null});
  }catch{send(502,{error:controller.signal.aborted?'Jev timed out; using local planner':'Jev unavailable; using local planner'});}
  finally{clearTimeout(timeout);res.off('close',abort);busy=false;}
 };
}
export function jevPlugin(env){
 let apiKey=env.TYPESAFE_API_KEY||'';
 if(!apiKey){try{apiKey=readFileSync(new URL('../credentials/Typesafe.txt',import.meta.url),'utf8').trim();}catch{}}
 const middleware=createJevMiddleware({apiKey,model:env.TYPESAFE_MODEL||'jev-latest'});
 return {name:'local-jev',configureServer(server){server.middlewares.use(middleware);},configurePreviewServer(server){server.middlewares.use(middleware);}};
}
