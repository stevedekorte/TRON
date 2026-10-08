import assert from 'node:assert/strict';
import {TANK_HULL} from '../src/simulation/tank-hull-collision.js';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.route('**/hull-fixture',r=>r.fulfill({contentType:'text/html',body:'<body></body>'}));await page.goto('http://127.0.0.1:5173/hull-fixture');
 const hull=await page.evaluate(async()=>{
  const {createTank}=await import('/src/rendering/models.js');const tank=await createTank(),points=[];
  for(const mesh of tank.root.children){if(!mesh.isMesh||mesh.userData.breakupExclude)continue;const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)points.push([p.getX(i),p.getZ(i)]);}
  const unique=[...new Map(points.map(p=>[p.map(v=>v.toFixed(5)).join(','),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);const lower=[],upper=[];
  for(const p of unique){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=1e-5)lower.pop();lower.push(p);}
  for(const p of unique.reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=1e-5)upper.pop();upper.push(p);}
  return lower.slice(0,-1).concat(upper.slice(0,-1)).map(p=>p.map(v=>Number(v.toFixed(4))));
 });assert(hull.every(([x,z])=>Math.abs(x)<TANK_HULL.halfWidthMeters&&Math.abs(z)<TANK_HULL.halfLengthMeters));console.log('Collision footprint encloses every measured hull vertex.');
}finally{await browser.close();}
