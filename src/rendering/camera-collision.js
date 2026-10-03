import {Vector3} from 'three';

export const CAMERA_CLEARANCE=Object.freeze({radiusMeters:1.2,gunnerRadiusMeters:.2,contactMarginMeters:.05,anchorHeightMeters:3.5,recoverySpeedMetersPerSecond:100,stalledProgressRatio:.1,lateralStepMeters:4,lateralSearchRadiusMeters:64,lateralSearchNodes:512});
const point=v=>({x:v.x,y:v.y,s:-v.z});

// Return to the near side of a padded wall, with a meter-based margin rather
// than a minimum fraction that could leave a long camera boom inside a wall.
export function clipCameraSegment(world,start,end,radius=CAMERA_CLEARANCE.radiusMeters){
 const hit=world.wallIntersection(point(start),point(end),radius);
 if(hit===null)return false;
 const length=start.distanceTo(end);
 end.lerpVectors(start,end,Math.max(0,hit-CAMERA_CLEARANCE.contactMarginMeters/Math.max(length,1e-9)));
 return true;
}

export function constrainCamera(world,anchor,position,previous,radius=CAMERA_CLEARANCE.radiusMeters,keepSight=true,recovery=null,dt=1/60,preferLateral=false){
 const wanted=position.clone();
 // Aerial views may look over an intervening wall. Only the close follow
 // camera needs an unobstructed boom; both modes still sweep their movement.
 if(keepSight||world.wallIntersection(point(position),point(position),radius)!==null)clipCameraSegment(world,anchor,position,radius);
 if(previous&&world.wallIntersection(point(previous),point(previous),radius)===null){
  if(recovery?.active&&world.wallIntersection(point(previous),point(anchor),radius)===null)recovery.active=false;
  const destination=position.clone();
  // A manual aerial move no longer needs the follow-camera escape waypoint
  // once its requested path is clear, even if the tank is behind a wall.
  if(recovery?.active&&!keepSight&&world.wallIntersection(point(previous),point(destination),radius)===null)recovery.active=false;
  if(clipCameraSegment(world,previous,position,radius)){
   // Slide along a roof/face instead of cutting across it. Height first lets
   // a rising zoom clear the roof before it moves out over the maze.
   const candidate=new Vector3();let distance=position.distanceToSquared(destination);
   for(const axis of (preferLateral?['x','z']:['y','x','z'])){
    candidate.copy(previous);candidate[axis]=destination[axis];
    clipCameraSegment(world,previous,candidate,radius);
    const remaining=candidate.distanceToSquared(destination);
    if(remaining<distance){position.copy(candidate);distance=remaining;}
   }
   // Each candidate is swept directly from the previous rendered frame;
   // combining axis moves could otherwise cut back through a corner.
   if(recovery&&!recovery.active&&previous.distanceTo(position)<Math.max(.001,previous.distanceTo(destination)*CAMERA_CLEARANCE.stalledProgressRatio)){
    recovery.active=true;
    recovery.waypoints=preferLateral?lateralCameraPath(world,previous,anchor,radius):null;
    recovery.height=Math.max(world.WALL_HEIGHT??previous.y,previous.y)+radius+CAMERA_CLEARANCE.contactMarginMeters;
   }
  }
  if(recovery?.active){
   // Escaping a concave corner can require moving away from the desired
   // camera. Prefer a swept horizontal route for CLU; use the roof only
   // when no local horizontal escape exists. Track the tank and resume follow
   // as soon as the tank is visible. Every recovery step is still swept.
   while(recovery.waypoints?.length&&previous.distanceTo(recovery.waypoints[0])<.05)recovery.waypoints.shift();
   const waypoint=recovery.waypoints?.[0]??(previous.y<recovery.height-.01
    ?new Vector3(previous.x,recovery.height,previous.z)
    :new Vector3(anchor.x,recovery.height,anchor.z));
   const distance=previous.distanceTo(waypoint),step=CAMERA_CLEARANCE.recoverySpeedMetersPerSecond*Math.max(0,dt);
   position.lerpVectors(previous,waypoint,Math.min(1,step/Math.max(distance,1e-9)));
   clipCameraSegment(world,previous,position,radius);
  }
 }
 return !position.equals(wanted);
}

// Bounded local A*: a detour may need both corners of a wall, so a single
// sideways probe is insufficient. Every edge is sphere-swept, including diagonals.
export function lateralCameraPath(world,start,anchor,radius=CAMERA_CLEARANCE.radiusMeters){
 const goal=anchor.clone();goal.y=start.y;
 const step=CAMERA_CLEARANCE.lateralStepMeters,limit=CAMERA_CLEARANCE.lateralSearchRadiusMeters;
 const clear=(a,b)=>world.wallIntersection(point(a),point(b),radius)===null;
 const first={position:start.clone(),cost:0,parent:null};
 const open=[first],costs=new Map([['0,0',0]]);
 for(let visited=0;open.length&&visited<CAMERA_CLEARANCE.lateralSearchNodes;visited++){
  open.sort((a,b)=>(a.cost+a.position.distanceTo(goal))-(b.cost+b.position.distanceTo(goal)));
  const current=open.shift();
  if(clear(current.position,goal)){
   const path=[goal];for(let node=current;node.parent;node=node.parent)path.unshift(node.position);
   // Skip intermediate grid points whenever the direct segment is safe.
   let from=start;const smooth=[];
   while(path.length){let i=path.length-1;while(i>0&&!clear(from,path[i]))i--;from=path[i];smooth.push(from);path.splice(0,i+1);}
   return smooth;
  }
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
   if(!dx&&!dz)continue;
   const next=current.position.clone().add(new Vector3(dx*step,0,dz*step));
   if(Math.abs(next.x-start.x)>limit||Math.abs(next.z-start.z)>limit)continue;
   const key=`${Math.round((next.x-start.x)/step)},${Math.round((next.z-start.z)/step)}`,cost=current.cost+Math.hypot(dx,dz)*step;
   if(cost>=(costs.get(key)??Infinity)||!clear(current.position,next))continue;
   costs.set(key,cost);open.push({position:next,cost,parent:current});
  }
 }
 return null;
}
