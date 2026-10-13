import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.route('**/src/mcp/voice.js',r=>r.fulfill({contentType:'application/javascript',body:'export class McpVoice {ready=false;generating=false;load(){return new Promise(()=>{});}abort(){}cancel(){}}'}));
 await page.route('**/api/mcp/status',r=>r.fulfill({json:{configured:true}}));
 await page.goto('http://127.0.0.1:5173/mcp.html');
 await page.evaluate(()=>document.fonts.ready);
 for(const id of ['face','face-fallback','controls','heard','message-form'])assert(await page.locator('#'+id).isHidden());
 await page.waitForFunction(()=>document.querySelector('#reply').textContent.length>0);
 assert(await page.locator('#reply').isVisible());assert(await page.locator('#encom-panel').isVisible());
 const box=await page.locator('#conversation').boundingBox();assert(Math.abs(box.x-1600*.204)<1);assert(Math.abs(box.y-275)<1);
 assert(!requests.some(url=>url.includes('/src/mcp/face.js')));
 await page.waitForFunction(()=>document.querySelector('#reply').textContent==='REQUEST: ACCESS TO MASTER CONTROL PROGRAM.',{},{timeout:25000});
 await page.waitForFunction(()=>document.querySelector('#reply').textContent.startsWith('MASTER CONTROL PROGRAM UNAVAILABLE\nAUDIO INPUT'));
 assert.match(await page.locator('#reply').textContent(),/MASTER CONTROL PROGRAM UNAVAILABLE\nAUDIO INPUT/);
 assert.equal(await page.locator('#reply').evaluate(e=>getComputedStyle(e,'::after').content),'none');
 await page.screenshot({path:'test-results/mcp-terminal.png'});
 await page.keyboard.press('Escape');assert(await page.locator('#exit-confirm').isVisible());
 assert.deepEqual(errors,[]);
 console.log('MCP terminal access request, hidden UI/face, panel, and Escape confirmation passed.');
}finally{await browser.close();}
