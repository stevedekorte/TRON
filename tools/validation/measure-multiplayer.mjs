import WebSocket from 'ws';
import {writeFile} from 'node:fs/promises';
import {decodeSnapshot} from '../../shared/multiplayer/snapshots.js';
import {MP} from '../../shared/multiplayer/config.js';
const url=process.env.MP_PROBE_URL||`wss://tron-jev.tron-canyon-run.workers.dev/api/multiplayer?v=${MP.protocol}`;
const origin=process.env.MP_PROBE_ORIGIN||(url.startsWith('wss:')?'https://dekorte.com':new URL(url).origin.replace('ws:','http:'));
const quant=(a,p)=>[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))]??null;
const stats=a=>({n:a.length,p50:quant(a,.5),p95:quant(a,.95),p99:quant(a,.99),max:a.length?Math.max(...a):null});
// One test participant joins the live room and acknowledges camera readiness.
// Run with MP_PROBE_URL/MP_PROBE_ORIGIN for another deployment.
const rows=[],rtts=[];let state,id,pinger,serverTiming;
const durationSeconds=Math.max(10,Math.min(120,Number(process.env.MP_PROBE_SECONDS)||65));
const started=performance.now();
await new Promise((resolve,reject)=>{
 const ws=new WebSocket(url,{origin});
 const stop=setTimeout(()=>ws.close(),durationSeconds*1000);
 ws.on('open',()=>{pinger=setInterval(()=>ws.send(JSON.stringify({type:'ping',sent:performance.now()})),250);});
 ws.on('message',raw=>{
  const now=performance.now(),msg=JSON.parse(String(raw));
  if(msg.type==='welcome'){id=msg.id;return;}
  if(msg.type==='pong'){rtts.push(now-msg.sent);serverTiming=msg.timing;return;}
  if(msg.type!=='state')return;
  state=decodeSnapshot(msg,state);if(!state)return;
  rows.push({now,sentAt:msg.sentAt,tick:state.tick,phase:state.race.phase,round:state.race.round,alive:state.race.cycles.filter(b=>b.alive).length,bytes:raw.length});
  const me=state.clients.find(c=>c.id===id);
  if(state.race.cameraStaging&&me)ws.send(JSON.stringify({type:'camera-ready',round:state.race.round,seat:me.seat}));
 });
 ws.on('close',()=>{clearTimeout(stop);clearInterval(pinger);resolve();});
 ws.on('error',e=>{clearTimeout(stop);clearInterval(pinger);reject(e);});
});
const gaps=[],late=[],racing=[];
for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i],gap=b.now-a.now;gaps.push(gap);late.push(gap-(b.tick-a.tick)*1000/MP.tickHz);if(a.phase==='racing'&&b.phase==='racing')racing.push(gap);}
const first=rows[0],last=rows.at(-1),summary={url,serverTiming,seconds:(performance.now()-started)/1000,rttMs:stats(rtts),snapshotGapMs:stats(gaps),racingGapMs:stats(racing),excessDeliveryGapMs:stats(late),serverTicksPerWallSecond:(last.tick-first.tick)*1000/(last.now-first.now),gapsOver75ms:gaps.filter(x=>x>75).length,gapsOver150ms:gaps.filter(x=>x>150).length,kilobytesPerSecond:rows.reduce((s,r)=>s+r.bytes,0)/(last.now-first.now),rounds:new Set(rows.map(r=>r.round)).size};
const delivery=[];for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i];if(Number.isFinite(a.sentAt)&&Number.isFinite(b.sentAt))delivery.push((b.now-a.now)-(b.sentAt-a.sentAt));}summary.deliveryVariationMs=stats(delivery);summary.longObservationGap=gaps.some(gap=>gap>5000);
console.log(JSON.stringify(summary,null,2));await writeFile(process.env.PROBE_REPORT||'test-results/host-latency.json',JSON.stringify({summary,rows,rtts},null,2));
