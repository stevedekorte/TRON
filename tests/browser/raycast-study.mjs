// The deployed analytic-surface study page (raycast-cycle.html): every shader
// variant (analytic/mesh, 1x/4x samples, shadows) compiles and draws without
// losing the context. TRON_ENGINES=chrome,webkit,firefox
import {chromium,webkit,firefox} from '@playwright/test';
import {silentChromeArgs,silentFirefoxPrefs} from './silent.mjs';
const ENGINES={chrome:()=>chromium.launch({channel:'chrome',headless:true,args:silentChromeArgs}),webkit:()=>webkit.launch({headless:true}),firefox:()=>firefox.launch({headless:true,firefoxUserPrefs:silentFirefoxPrefs})};
let failed=false;
for(const name of (process.env.TRON_ENGINES||'chrome,webkit,firefox').split(',')){
 const browser=await ENGINES[name]();
 try{
  const page=await browser.newPage({viewport:{width:960,height:600}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/CONTEXT_LOST|XPC/.test(m.text()))errors.push(m.text().slice(0,160));});
  await page.addInitScript(()=>{window.__lost=false;addEventListener('webglcontextlost',()=>{window.__lost=true;},true);});
  await page.goto('http://127.0.0.1:5173/raycast-cycle.html');
  await page.waitForTimeout(4000);
  const results=[];
  for(const [aa,shadows] of [[true,false],[false,false],[false,true],[true,true]]){
   await page.locator('#aa').setChecked(aa);await page.locator('#shadows').setChecked(shadows);
   await page.waitForTimeout(3000);
   const lost=await page.evaluate(()=>window.__lost||[...document.querySelectorAll('canvas')].some(c=>c.getContext('webgl2')?.isContextLost()));
   results.push(`${aa?'4x':'1x'}${shadows?'+shadows':''}:${lost?'LOST':'ok'}`);
   await page.screenshot({path:`test-results/raycast-${name}-${aa?4:1}${shadows?'-shadows':''}.png`});
   if(lost)break;
  }
  const pass=!results.some(r=>r.includes('LOST'))&&!errors.length;failed||=!pass;
  console.log(`${pass?'PASS':'FAIL'} ${name}`,results.join(' '),errors.slice(0,3));
 }finally{await browser.close();}
}
process.exitCode=failed?1:0;
