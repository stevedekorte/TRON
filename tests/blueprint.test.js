import test from 'node:test';
import assert from 'node:assert/strict';
import * as maze from '../src/levels/blueprint-maze.js';
test('traced islands triangulate without filling concave notches',()=>{
 assert.equal(maze.WALLS.length,20);
 for(const w of maze.WALLS){
  const polygonArea=Math.abs(w.points.reduce((a,p,i)=>{const q=w.points[(i+1)%w.points.length];return a+p.x*q.s-q.x*p.s;},0))/2;
  const triangleArea=w.triangles.reduce((area,edges)=>{const [a,b,c]=edges.map(e=>e.a);return area+Math.abs((b.x-a.x)*(c.s-a.s)-(b.s-a.s)*(c.x-a.x))/2;},0);
  assert.ok(Math.abs(polygonArea-triangleArea)<1e-6);
 }
 const notch=maze.pixelToWorld([435,120]);assert.equal(maze.wallAt(notch.x,notch.s),false);
 assert.equal(maze.wallIntersection({...notch,y:10},{...notch,y:11}),null);
 const solid=maze.pixelToWorld([350,50]);assert.equal(maze.wallAt(solid.x,solid.s),true);
 assert.equal(maze.wallIntersection({...solid,y:10},{...solid,y:11}),0);
 assert.equal(maze.wallIntersection({...solid,y:60},{...solid,y:70}),null);
});
test('point occupancy and triangulated visibility agree throughout the blueprint',()=>{
 for(let y=4;y<941;y+=17)for(let x=4;x<1672;x+=17){
  const p=maze.pixelToWorld([x,y]);assert.equal(maze.wallIntersection({...p,y:10},{...p,y:11})!==null,maze.wallAt(p.x,p.s));
 }
});
test('spawn and navigation samples clear traced walls',()=>{
 assert.ok(maze.freePosition(maze.SPAWN.x,maze.SPAWN.s,3.5));
 for(let y=980;y>=865;y-=2){const p=maze.pixelToWorld([1288,y]);assert.ok(maze.freePosition(p.x,p.s,3.5));}
 assert.ok(maze.OPEN_CELLS.length>200);
 for(const p of maze.OPEN_CELLS)assert.ok(maze.freePosition(p.x,p.s,4));
});


test('initial tank position is one maze width outside the southern boundary',()=>{
 assert.ok(Math.abs((-maze.FLOOR_HALF[1]-maze.SPAWN.s)-maze.HALF*2)<1e-8);
 for(let s=maze.SPAWN.s;s< -maze.FLOOR_HALF[1];s+=10)assert.ok(maze.freePosition(maze.SPAWN.x,s,3.5));
});
