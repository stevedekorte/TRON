// POST /api/errors: store small, anonymous client crash reports in D1.
export const ERROR_REPORT_LIMITS=Object.freeze({
  bodyBytes:12000,            // bytes per report
  clientPerHour:20,           // reports per rotating client hash
  globalPerDay:5000,          // reports per UTC day, well inside D1's free write quota
  retentionDays:90,           // days
  pruneProbability:.02,       // fraction of inserts that also delete expired rows
});
const FIELDS={kind:40,message:500,stack:4000,source:300,build:40,host:100,path:200,userAgent:300,gpu:200,game:40,mode:40,detail:300};
const KINDS=new Set(['error','rejection','failure','context-lost']);
const HOUR=3600000,DAY=86400000;

export function cleanErrorReport(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('json');
 const report={};
 for(const [key,limit] of Object.entries(FIELDS)){const v=value[key];report[key]=typeof v==='string'?v.slice(0,limit):'';}
 if(!KINDS.has(report.kind)||!report.message)throw new Error('json');
 const uptime=Number(value.uptimeSeconds);report.uptimeSeconds=Number.isFinite(uptime)?Math.max(0,Math.min(1e7,Math.round(uptime))):0;
 return report;
}

async function readBounded(request){
 if(Number(request.headers.get('Content-Length'))>ERROR_REPORT_LIMITS.bodyBytes)throw new Error('size');
 const text=await request.text();
 if(new TextEncoder().encode(text).byteLength>ERROR_REPORT_LIMITS.bodyBytes)throw new Error('size');
 return JSON.parse(text);
}

export async function errorRoute(request,env,ctx,{send,clientHash,now=Date.now()}){
 if(request.method!=='POST')return send(405,{error:'Method not allowed'});
 const db=env.ERROR_REPORTS;if(!db)return send(503,{error:'Error reporting unavailable'});
 const ip=request.headers.get('CF-Connecting-IP');if(!ip)return send(403,{error:'Missing client identity'});
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return send(415,{error:'JSON required'});
 let report;
 try{report=cleanErrorReport(await readBounded(request));}
 catch(error){return send(error.message==='size'?413:400,{error:'Invalid or oversized error report'});}
 const client=await clientHash(ip,env.ERROR_REPORT_SALT||env.TYPESAFE_API_KEY||'tron-error-reports');
 const recent=await db.prepare('SELECT COUNT(*) AS n FROM error_reports WHERE client=? AND received_at>?').bind(client,now-HOUR).first();
 if((recent?.n??0)>=ERROR_REPORT_LIMITS.clientPerHour)return send(429,{error:'Too many error reports',retryAfter:3600},{'Retry-After':'3600'});
 const today=await db.prepare('SELECT COUNT(*) AS n FROM error_reports WHERE received_at>=?').bind(Math.floor(now/DAY)*DAY).first();
 if((today?.n??0)>=ERROR_REPORT_LIMITS.globalPerDay)return send(429,{error:'Error report quota reached',retryAfter:3600},{'Retry-After':'3600'});
 await db.prepare(`INSERT INTO error_reports (received_at,client,kind,message,stack,source,build,host,path,user_agent,gpu,game,mode,detail,uptime_seconds)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(now,client,report.kind,report.message,report.stack,report.source,report.build,report.host,report.path,report.userAgent,report.gpu,report.game,report.mode,report.detail,report.uptimeSeconds).run();
 if(Math.random()<ERROR_REPORT_LIMITS.pruneProbability)
  ctx?.waitUntil?.(db.prepare('DELETE FROM error_reports WHERE received_at<?').bind(now-ERROR_REPORT_LIMITS.retentionDays*DAY).run().catch(()=>{}));
 return send(202,{ok:true});
}
