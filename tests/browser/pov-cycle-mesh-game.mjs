// In the game: the same cycle and camera drawn by the POV-Ray renderer and by the
// normal renderer with the fallback mesh converted from it (and the earlier imported
// model with ?cycleModel=preti), for review. The meshes must line up with the CSG.
import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.TRON_URL||'http://127.0.0.1:5173/';
const out='test-results/cycle-rendering/pov-cycle-mesh-game';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
const errors=[];
async function capture(query,renderers){
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE|GLTF/.test(m.text()))errors.push(m.text());});
 await page.goto(base+'?cycleStart=1&layoutSeed=1982'+query);
 await page.waitForFunction(()=>{try{return __tron.state.cycleRace?.phase==='racing';}catch{return false;}},null,{timeout:120000});
 await page.waitForTimeout(2500);await page.keyboard.press('Escape');await page.waitForTimeout(300);
 await page.addStyleTag({content:'#exit-confirm,#paused,#hud,#cycle-roster,#controls-prompt{visibility:hidden!important}'});
 // A teammate a few metres ahead of the player, seen from four sides.
 const b=await page.evaluate(()=>{const r=__tron.state.cycleRace,me=r.cycles[r.playerId],b=r.cycles.find(c=>c.team===me.team&&c.id!==me.id&&c.alive)??me,C=4.8;return {x:b.x*C+r.site.x,z:b.z*C-r.site.s,dir:b.dir};});
 const f=[[0,-1],[1,0],[0,1],[-1,0]][b.dir],s=[-f[1],f[0]];
 const poses={side:[[b.x+s[0]*5,1.2,b.z+s[1]*5],[b.x,.7,b.z]],frontQuarter:[[b.x+f[0]*4+s[0]*3,1.6,b.z+f[1]*4+s[1]*3],[b.x,.6,b.z]],rearQuarter:[[b.x-f[0]*4-s[0]*3,1.8,b.z-f[1]*4-s[1]*3],[b.x,.6,b.z]],frontWheel:[[b.x+f[0]*2.4+s[0]*1.5,.7,b.z+f[1]*2.4+s[1]*1.5],[b.x+f[0]*1.2,.55,b.z+f[1]*1.2]]};
 for(const renderer of renderers){
  await page.evaluate(r=>__tron.setCycleRenderer(r),renderer);await page.waitForTimeout(1200);
  for(const [name,[position,target]] of Object.entries(poses)){await page.evaluate(p=>__tron.reviewCamera(p),{position,target,fov:45});await page.waitForTimeout(250);await page.screenshot({path:`${out}/${name}-${renderer}${query.includes('preti')?'-preti':''}.png`});}
 }
 await page.close();return Object.keys(poses);
}
try{
 const names=await capture('',['pov','normal']);
 await capture('&cycleModel=preti',['normal']);
 execFileSync('magick',['montage',...names.flatMap(n=>[`${out}/${n}-pov.png`,`${out}/${n}-normal.png`,`${out}/${n}-normal-preti.png`]),'-tile','3x','-geometry','640x360+3+3','-background','black',`${out}/sheet.png`]);
 for(const n of names){try{execFileSync('magick',['compare','-metric','AE','-fuzz','10%',`${out}/${n}-pov.png`,`${out}/${n}-normal.png`,`${out}/${n}-diff.png`],{stdio:'pipe'});}catch{}}
 console.log(JSON.stringify({captured:names,errors}));assert.deepEqual(errors,[]);
}finally{await browser.close();}
