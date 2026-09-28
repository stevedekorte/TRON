import test from 'node:test';
import assert from 'node:assert/strict';
import {createOutlineMaze} from '../src/levels/outline-maze.js';
import {seededRandom} from '../src/game/random.js';
const maze=createOutlineMaze({size:[100,100],metersPerPixel:1,shapes:[
 {outline:[[0,0],[100,1],[45,6],[45,80],[0,100]],holes:[[[10,20],[20,20],[20,40],[10,40]]]},
 {outline:[[55,20],[90,20],[90,90],[55,90]]},
]});
// Unaccelerated clipping oracle: preserve nearest hits and acute padded corners.
function original(a,b,padding){
 let nearest=null;
 for(const w of maze.WALLS){
  if(Math.max(a.x,b.x)<w.minX-padding||Math.min(a.x,b.x)>w.maxX+padding||Math.max(a.s,b.s)<w.minS-padding||Math.min(a.s,b.s)>w.maxS+padding)continue;
  for(const triangle of w.triangles){
   let enter=0,leave=1;
   const clip=(start,delta,limit)=>{if(Math.abs(delta)<1e-10){if(start>limit+1e-8)enter=2;return;}const t=(limit-start)/delta;if(delta<0)enter=Math.max(enter,t);else leave=Math.min(leave,t);};
   clip(a.y,b.y-a.y,54+padding);clip(-a.y,a.y-b.y,1);
   for(const e of triangle)clip((a.x-e.a.x)*e.nx+(a.s-e.a.s)*e.ns,(b.x-a.x)*e.nx+(b.s-a.s)*e.ns,padding);
   if(enter<=leave&&leave>=0&&enter<=1&&(nearest===null||enter<nearest))nearest=Math.max(0,enter);
  }
 }
 return nearest;
}
test('accelerated outline collision matches exhaustive clipping, including padding and holes',()=>{
 const random=seededRandom(1982),point=()=>({x:random()*160-80,s:random()*160-80,y:random()*80-5});
 for(let i=0;i<10000;i++){
  const a=point(),b=i%5?point():a,padding=[0,.5,3.5,8][i%4],expected=original(a,b,padding);
  assert.equal(maze.wallIntersection(a,b,padding),expected);
  assert.equal(maze.wallIntersection(a,b,padding,true)!==null,expected!==null);
 }
});
