import {DEFAULT_WORLD} from '../levels/scenario.js';
import {config,configFor} from '../game/config.js';
import {TACTICAL} from '../game/tactical.js';
// Hypotheses for where a tank could have travelled, not aircraft flight paths.
// Every graph edge sweeps the tank footprint; proximity across a wall is not connectivity.
export function connectedSearchRoutes(origin,{radius=TACTICAL.searchRadiusMeters,step=TACTICAL.searchStepMeters,limit=TACTICAL.searchNodeLimit,
 world=DEFAULT_WORLD,vehicleConfig=config,clear=(a,b)=>world.wallIntersection({...a,y:2.8},{...b,y:2.8},vehicleConfig.tankRadius-.1)===null}={}){
 if(!clear(origin,origin))return [];
 const queue=[{x:origin.x,s:origin.s,ix:0,is:0,cost:0,parent:null}],seen=new Set(['0,0']);
 for(let index=0;index<queue.length&&queue.length<limit;index++){
  const n=queue[index];
  for(const [dx,ds] of [[0,1],[1,0],[0,-1],[-1,0]]){
   const ix=n.ix+dx,is=n.is+ds,key=`${ix},${is}`,cost=n.cost+step;
   if(seen.has(key)||cost>radius)continue;
   const p={x:origin.x+ix*step,s:origin.s+is*step};if(!clear(n,p))continue;
   seen.add(key);queue.push({...p,ix,is,cost,parent:n});if(queue.length>=limit)break;
  }
 }
 return queue.slice(1).map(n=>{const path=[];for(let p=n;p;p=p.parent)path.unshift({x:p.x,s:p.s});return {x:n.x,s:n.s,cost:n.cost,path};});
}
