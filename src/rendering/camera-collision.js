import {Vector3} from 'three';

export const CAMERA_CLEARANCE=Object.freeze({radiusMeters:1.2,gunnerRadiusMeters:.2,contactMarginMeters:.05,anchorHeightMeters:3.5,recoverySpeedMetersPerSecond:100,stalledProgressRatio:.1});
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

export function constrainCamera(world,anchor,position,previous,radius=CAMERA_CLEARANCE.radiusMeters,keepSight=true,recovery=null,dt=1/60){
 const wanted=position.clone();
 // Aerial views may look over an intervening wall. Only the close follow
 // camera needs an unobstructed boom; both modes still sweep their movement.
 if(keepSight||world.wallIntersection(point(position),point(position),radius)!==null)clipCameraSegment(world,anchor,position,radius);
 if(previous&&world.wallIntersection(point(previous),point(previous),radius)===null){
  if(recovery?.active&&world.wallIntersection(point(previous),point(anchor),radius)===null)recovery.active=false;
  const destination=position.clone();
  if(clipCameraSegment(world,previous,position,radius)){
   // Slide along a roof/face instead of cutting across it. Height first lets
   // a rising zoom clear the roof before it moves out over the maze.
   const candidate=new Vector3();let distance=position.distanceToSquared(destination);
   for(const axis of ['y','x','z']){
    candidate.copy(previous);candidate[axis]=destination[axis];
    clipCameraSegment(world,previous,candidate,radius);
    const remaining=candidate.distanceToSquared(destination);
    if(remaining<distance){position.copy(candidate);distance=remaining;}
   }
   // Each candidate is swept directly from the previous rendered frame;
   // combining axis moves could otherwise cut back through a corner.
   if(recovery&&!recovery.active&&previous.distanceTo(position)<Math.max(.001,previous.distanceTo(destination)*CAMERA_CLEARANCE.stalledProgressRatio)){
    recovery.active=true;
    recovery.height=Math.max(world.WALL_HEIGHT??previous.y,previous.y)+radius+CAMERA_CLEARANCE.contactMarginMeters;
   }
  }
  if(recovery?.active){
   // Escaping a concave corner can require moving away from the desired
   // camera. Rise above the wall, track the moving tank, then resume follow
   // as soon as the tank is visible. Every recovery step is still swept.
   const waypoint=previous.y<recovery.height-.01
    ?new Vector3(previous.x,recovery.height,previous.z)
    :new Vector3(anchor.x,recovery.height,anchor.z);
   const distance=previous.distanceTo(waypoint),step=CAMERA_CLEARANCE.recoverySpeedMetersPerSecond*Math.max(0,dt);
   position.lerpVectors(previous,waypoint,Math.min(1,step/Math.max(distance,1e-9)));
   clipCameraSegment(world,previous,position,radius);
  }
 }
 return !position.equals(wanted);
}
