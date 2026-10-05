import {Box3,Vector3,MathUtils} from 'three';

// Fit visible geometry rather than a shared camera distance: long, thin ships
// should use the same available screen space as compact characters.
export function creditPreviewPoints(model){
 model.updateMatrixWorld(true);const points=[];
 model.traverseVisible(o=>{
  if(!o.geometry)return;
  o.geometry.computeBoundingBox();const box=o.geometry.boundingBox;
  if(!box||box.isEmpty())return;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])
   points.push(new Vector3(x,y,z).applyMatrix4(o.matrixWorld));
 });
 return points;
}
export function fitCreditPreview(camera,model,aspect,elevated=false,frameFraction=.84){
 const points=creditPreviewPoints(model);if(!points.length)return;
 const center=new Box3().setFromPoints(points).getCenter(new Vector3());
 const back=new Vector3(2,elevated?3.6:1.35,3.2).normalize();
 const right=new Vector3().crossVectors(new Vector3(0,1,0),back).normalize(),up=new Vector3().crossVectors(back,right);
 const tanY=Math.tan(MathUtils.degToRad(camera.fov/2))*frameFraction,tanX=tanY*aspect;
 let distance=0;
 for(const p of points){const delta=p.clone().sub(center),depth=delta.dot(back);distance=Math.max(distance,depth+Math.abs(delta.dot(right))/tanX,depth+Math.abs(delta.dot(up))/tanY);}
 camera.aspect=aspect;camera.position.copy(center).addScaledVector(back,distance);camera.lookAt(center);camera.updateProjectionMatrix();camera.updateMatrixWorld();
}
