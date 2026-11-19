// Full game smoke test per platform profile available on this Mac: enter the
// light-cycle arena, check the cycle renderer choice, page errors and that the
// arena renders. Mobile profiles are emulated (UA, touch, viewport), not devices.
// TRON_PLATFORMS=chrome,safari,firefox,iphone,android,software
import {chromium,webkit,firefox,devices} from '@playwright/test';
import {silentChromeArgs,silentFirefoxPrefs,silence} from './silent.mjs';
import sharp from 'sharp';
const PLATFORMS={
 chrome:{launch:()=>chromium.launch({channel:'chrome',headless:true,args:silentChromeArgs}),context:{viewport:{width:1280,height:720}},renderer:'pov'},
 safari:{launch:()=>webkit.launch({headless:true}),context:{viewport:{width:1280,height:720}},renderer:'pov'},
 firefox:{launch:()=>firefox.launch({headless:true,firefoxUserPrefs:silentFirefoxPrefs}),context:{viewport:{width:1280,height:720}},renderer:'pov'},
 iphone:{launch:()=>webkit.launch({headless:true}),context:{...devices['iPhone 15 Pro landscape']},renderer:'normal'},
 android:{launch:()=>chromium.launch({channel:'chrome',headless:true,args:silentChromeArgs}),context:{...devices['Pixel 7 landscape']},renderer:'normal'},
 software:{launch:()=>chromium.launch({channel:'chrome',headless:true,args:[...silentChromeArgs,'--use-angle=swiftshader','--enable-unsafe-swiftshader']}),context:{viewport:{width:960,height:540}},renderer:'normal',phases:['countdown','racing']},
};
const names=(process.env.TRON_PLATFORMS||Object.keys(PLATFORMS).join(',')).split(',');
let failed=false;
for(const name of names){
 const platform=PLATFORMS[name],browser=await platform.launch();
 try{
  const context=await browser.newContext(platform.context);await silence(context);const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!/api\/jev|Failed to load resource|Jev/i.test(m.text()))errors.push(m.text().slice(0,200));});
  await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'Test unavailable'}}));
  await page.goto('http://127.0.0.1:5173/?layoutSeed=1982&cycleStart=0');
  await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-cycles').disabled,{},{timeout:240000});
  const mobile=await page.evaluate(()=>document.body.classList.contains('mobile-terminal'));
  if(platform.context.hasTouch){const solo=page.locator('#game-menu .game-choice[data-game="cycles"]');await solo.tap();await page.waitForTimeout(300);if(await page.evaluate(()=>__tron.state.mode==='ready'))await solo.tap();}else await page.keyboard.press('Enter');
  await page.waitForFunction(phases=>window.__tron?.state.playerVehicle==='cycle'&&phases.includes(__tron.state.cycleRace.phase),platform.phases??['racing'],{timeout:240000});
  if(platform.renderer==='pov')await page.waitForFunction(()=>__tron.state.cycleRendererMode==='pov'&&__tron.state.csgCycleCount>0,{},{timeout:120000});
  await page.waitForTimeout(4000);
  const state=await page.evaluate(()=>{const gl=document.querySelector('#game').getContext('webgl2'),info=gl.getExtension('WEBGL_debug_renderer_info');
   return {gpu:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),mode:__tron.state.mode,renderer:__tron.state.cycleRendererMode,csg:__tron.state.csgCycleCount,lost:gl.isContextLost(),button:document.querySelector('#cycle-renderer')?.textContent};});
  const shot=await page.screenshot({path:`test-results/platform-${name}.png`});
  const {data,info}=await sharp(shot).raw().toBuffer({resolveWithObject:true});let lit=0;for(let i=0;i<data.length;i+=info.channels)if(data[i]+data[i+1]+data[i+2]>60)lit++;
  state.litPercent=+(100*lit/(info.width*info.height)).toFixed(1);state.mobile=mobile;
  const pass=state.renderer===platform.renderer&&!state.lost&&state.mode!=='error'&&state.litPercent>2&&!errors.length;failed||=!pass;
  console.log(`${pass?'PASS':'FAIL'} ${name}`,JSON.stringify(state),errors.length?errors.slice(0,5):'');
 }catch(error){failed=true;const page=browser.contexts()[0]?.pages()[0];let detail='';
  if(page){await page.screenshot({path:`test-results/platform-${name}-fail.png`}).catch(()=>{});detail=await page.evaluate(()=>({ready:!!window.__tron,startDisabled:document.querySelector('#start')?.disabled,boot:document.querySelector('#boot-status')?.textContent,err:document.querySelector('#error-message')?.textContent,mode:(()=>{try{return __tron.state.mode}catch(e){return 'n/a'}})(),vehicle:(()=>{try{return __tron.state.playerVehicle+'/'+__tron.state.cycleRace?.phase}catch(e){return 'n/a'}})()})).catch(e=>e.message);}
  console.log(`FAIL ${name}`,error.message.split('\n')[0],JSON.stringify(detail));}
 finally{await browser.close();}
}
process.exitCode=failed?1:0;
