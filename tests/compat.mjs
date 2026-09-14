import { firefox, webkit } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const reports=[];
const watchdog=setTimeout(async()=>{
  reports.push({passed:false,error:'Compatibility attempt exceeded 45 seconds; cached browser may not match the installed Playwright protocol.'});
  await writeFile('test-results/compat.json',JSON.stringify(reports,null,2));console.error(reports.at(-1).error);process.exit(1);
},45_000);
for(const [name,type,path] of [
  ['Firefox',firefox,process.env.TRON_FIREFOX_PATH || firefox.executablePath()],
  ['WebKit (Playwright, not Safari)',webkit,process.env.TRON_WEBKIT_PATH || webkit.executablePath()],
]){
  let browser;
  try{
    console.log(`Checking ${name}`);
    browser=await type.launch({executablePath:path,headless:true,timeout:15_000});
    const page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.waitForFunction(()=>document.querySelector('.terminal-copy.complete'));await page.keyboard.press('Enter');await page.waitForFunction(()=>document.body.classList.contains('playing'));
    await page.keyboard.down('KeyW');await page.waitForTimeout(2000);await page.keyboard.up('KeyW');
    const state=await page.evaluate(()=>window.__tron.state);assert.ok(state.s>20);assert.equal(errors.length,0,errors.join('\n'));
    await page.screenshot({path:`test-results/${name.startsWith('Firefox')?'firefox':'webkit'}.png`});
    reports.push({browser:name,version:await browser.version(),passed:true,s:state.s,errors});
  }catch(e){reports.push({browser:name,passed:false,error:e.message});}
  finally{await browser?.close();}
}
clearTimeout(watchdog);
await writeFile('test-results/compat.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
process.exitCode = reports.every(r=>r.passed) ? 0 : 1;
