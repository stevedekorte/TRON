const LIMIT=256;
const append=(a,value)=>{a.push(value);if(a.length>LIMIT)a.shift();};
const summarize=values=>{
 if(!values.length)return null;
 const sorted=[...values].sort((a,b)=>a-b),at=p=>Math.round(sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]*100)/100;
 return {samples:sorted.length,p50:at(.5),p95:at(.95),p99:at(.99),max:at(1)};
};
// Arrival deltas minus send deltas do not require synchronized wall clocks.
// They include transport AND client event-loop delay, not server scheduling.
export class MultiplayerDiagnostics{
 constructor(){this.rtt=[];this.gaps=[];this.deliveryVariation=[];this.last=null;this.server=null;}
 pong(message,now){append(this.rtt,Math.max(0,now-message.sent));if(message.timing)this.server=message.timing;}
 snapshot(message,now){
  if(this.last){
   const gap=now-this.last.now;
   if(gap>=0&&gap<5000){
    append(this.gaps,gap);
    const sentGap=message.sentAt-this.last.sentAt;
    if(Number.isFinite(sentGap)&&sentGap>=0)append(this.deliveryVariation,gap-sentGap);
   }
  }
  this.last={now,sentAt:message.sentAt};
 }
 report(playback){return {rttMs:summarize(this.rtt),snapshotGapMs:summarize(this.gaps),deliveryVariationMs:summarize(this.deliveryVariation),server:this.server,playback:playback?.diagnostics()};}
}
