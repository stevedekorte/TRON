import {LIGHT_CYCLES as C,CYCLE_DIRECTIONS as DIR} from '../config/light-cycles.js';
import {AI_LIMITS as L} from './config.js';
import {neuralScore,candidateFeatures} from './network.js';
import {forecastSpeed,arrivalSeconds} from './speed.js';
export function evaluateCandidate(q,b,dir,pedal,clear,space,policy,out,targetId=null){
 forecastSpeed(b,pedal,L.horizonSeconds,out);
 const [dx,dz]=DIR[dir],cells=out.distance/C.cellMeters,speed=C.speedMetersPerSecond*(b.speedMultiplier??1);
 const guardSpeed=Math.max(speed,out.speed*C.speedMetersPerSecond),required=guardSpeed*(L.guardSeconds+L.safetySeconds)/C.cellMeters;
 const travelSafe=q.trafficClearance(b,dir,L.guardSeconds+L.safetySeconds,guardSpeed);
 out.safe=clear>required&&travelSafe>=required-1e-8;
 out.dir=dir;out.pedal=pedal;out.reason='space';out.cutoff=0;
 // Pick a reachable waypoint; validate a perpendicular exit after the prefix.
 const leg=Math.min(cells,Math.max(0,clear-required)),ex=b.x+dx*leg,ez=b.z+dz*leg;
 const exitLeft=q.clearance(b,(dir+3)%4,required+2,ex,ez),exitRight=q.clearance(b,(dir+1)%4,required+2,ex,ez);
 out.exit=Math.max(exitLeft,exitRight);out.safe&&=out.exit>required||clear>cells+required;
 let pressure=0,ally=0,attack=0,overtake=0;
 for(const other of q.race.cycles){
  if(!other.alive||other===b||other.escaped)continue;
  const [ox,oz]=DIR[other.dir],distance=Math.hypot(other.x-b.x,other.z-b.z)*C.cellMeters;
  if(distance>180&&other.id!==targetId)continue;
  if(other.team===b.team){if(Math.hypot(ex-other.x,ez-other.z)<5)ally+=1;continue;}
  const otherSpeed=C.speedMetersPerSecond*(other.speedMultiplier??1);
  const tx=other.x+ox*otherSpeed*.8/C.cellMeters,tz=other.z+oz*otherSpeed*.8/C.cellMeters;
  if(other.id===targetId)pressure=(Math.hypot(b.x-tx,b.z-tz)-Math.hypot(ex-tx,ez-tz))/Math.max(1,leg);
  // Set up a subsequent crossing: gain a safe lead beside a parallel enemy.
  // Charge-limited speed forecasts determine whether this boost actually gains
  // ground; simply being near an opponent is not enough to spend turbo.
  if(pedal===1&&other.id===targetId&&dir===other.dir){
   const along=((other.x-b.x)*dx+(other.z-b.z)*dz)*C.cellMeters;
   const lateral=Math.abs((other.x-b.x)*dz-(other.z-b.z)*dx)*C.cellMeters;
   const lead=C.lengthMeters+policy.leadSeconds*otherSpeed;
   const gain=out.distance-otherSpeed*L.horizonSeconds;
   if(along>-lead&&along<L.overtakeMaxGapMeters&&lateral>=L.overtakeMinLateralMeters&&lateral<=L.overtakeMaxLateralMeters&&gain>0){
    overtake=L.overtakeSetupCredit*Math.min(1,gain/Math.max(C.lengthMeters,along+lead));
   }
  }
  // Candidate travels across the opponent's forward lane. Require room after
  // crossing for the rear emitter and a viable perpendicular escape.
  if(dx*ox+dz*oz===0){
   const ours=dx?(other.x-b.x)/dx:(other.z-b.z)/dz;
   const theirs=ox?(b.x-other.x)/ox:(b.z-other.z)/oz;
   if(ours>0&&theirs>0&&ours<leg){
    const arrival=arrivalSeconds(b,pedal,ours*C.cellMeters),committed=arrivalSeconds(other,other.boosting?1:other.braking?-1:0,theirs*C.cellMeters);
    if(committed<=arrival+L.safetySeconds)out.safe=false;
   }
   if(ours>0&&theirs>0&&ours+ C.lengthMeters/C.cellMeters<leg){
    const ourTime=arrivalSeconds(b,pedal,ours*C.cellMeters),theirTime=Math.min(arrivalSeconds(other,0,theirs*C.cellMeters),arrivalSeconds(other,1,theirs*C.cellMeters));
    const margin=theirTime-ourTime-C.lengthMeters/(out.distance/L.horizonSeconds);
    if(margin>policy.leadSeconds&&Number.isFinite(theirTime)&&theirTime<2&&out.exit>required){
     // Reward sealing a constrained approach more than a gratuitous crossing.
     const flank=Math.min(q.clearance(other,(other.dir+1)%4,8),q.clearance(other,(other.dir+3)%4,8));
     attack=Math.max(attack,Math.min(1,margin)*(.7+.3*(1-flank/8)));out.reason='cutoff';
    }
   }
  }
 }
 if(attack===0&&overtake>0)out.reason='overtake';
 out.overtake=overtake;out.cutoff=attack;out.clearance=clear;out.space=space;out.pressure=pressure;out.ally=ally;
 const reserve=pedal===1?(b.turboCharge??1):pedal===-1?(b.brakeCharge??1):1;
 // Turbo can earn a direct cutoff or prepare an overtake; empty straights do neither.
 if(pedal===1&&(reserve<policy.reserveFloor||(attack===0&&overtake===0)))out.safe=false;
 if(pedal===-1&&reserve<=0)out.safe=false;
 out.score=policy.space*space+policy.clearance*Math.min(clear/24,1)+policy.cutoff*(attack+overtake)+policy.pressure*pressure-policy.allyPenalty*ally-policy.reserveCost*out.spent;
 if(dir===b.dir)out.score+=policy.straightBonus;
 // Coasting is preferable when changing speed buys no safety/timing benefit.
 if(pedal!==0)out.score-=.04;
 if(policy.network&&out.safe){
  out.features??=new Float32Array(32);
  out.score+=neuralScore(policy.network,candidateFeatures(b,out,q.race.cycles.find(c=>c.id===targetId),out.features));
 }
 return out;
}
