import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1300,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/raster-check',r=>r.fulfill({contentType:'text/html',body:`<link rel="stylesheet" href="/src/ui/terminal.css"><style>body{margin:0;background:#020204}.terminal-content{top:70px;left:70px;width:1160px}.samples{font:56px/1.04 FilmTerminal;text-shadow:none}.small{font-size:28px}.large{font-size:80px}.end-tribute{display:block!important;margin-top:1em}</style><body class="terminal detached"><section class="intro"><div class="terminal-content"><div class="samples">CLU PROGRAM DETACHED FROM SYSTEM<br>MADE TOGETHER, ACROSS THE INTERFACE.<br><span class="terminal-signoff">END OF LINE</span></div><div class="samples small">CLU PROGRAM · SMALL TEXT<br><span class="terminal-signoff">END OF LINE</span></div><div class="samples large">CLU<br><span class="terminal-signoff">END OF LINE</span></div></div></section></body>`}));
 await page.goto('http://127.0.0.1:5174/raster-check');await page.evaluate(()=>document.fonts.ready);
 assert.ok(await page.evaluate(()=>document.fonts.check('56px FilmTerminal')));
 assert.equal(await page.locator('.intro').evaluate(e=>getComputedStyle(e,'::after').content),'none');
 const screenshot=await page.screenshot({path:'test-results/terminal-raster.png'});
 const colors=await page.evaluate(async base64=>{
  const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;
  const targets=[[21,157,221],[14,107,150],[255,48,37],[173,33,25]],counts=targets.map(()=>0);
  for(let i=0;i<data.length;i+=4)targets.forEach((rgb,k)=>{if(rgb.every((v,n)=>Math.abs(data[i+n]-v)<3))counts[k]++;});return counts;
 },screenshot.toString('base64'));
 assert.ok(colors.every(n=>n>50),`Expected bright and dim blue/red glyph layers: ${colors}`);assert.deepEqual(errors,[]);console.log({brightBlue:colors[0],dimBlue:colors[1],brightRed:colors[2],dimRed:colors[3]});
}finally{await browser.close();}
