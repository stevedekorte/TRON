import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();let downloads=0;
 await page.route('**/music-cache-fixture',r=>r.fulfill({contentType:'text/html',body:'Music cache test'}));
 await page.route('**/cache-track*.mp3',r=>{downloads++;return r.fulfill({contentType:'assets/audio/mpeg',body:'test-track-bytes'});});
 await page.goto('http://127.0.0.1:5173/music-cache-fixture');
 const read=()=>page.evaluate(async()=>{const {cachedMusicUrl}=await import('/src/mcp/music-cache.js');const url=await cachedMusicUrl('/cache-track-v1.mp3');const text=await (await fetch(url)).text();URL.revokeObjectURL(url);return text;});
 assert.equal(await read(),'test-track-bytes');assert.equal(downloads,1);
 await page.reload();assert.equal(await read(),'test-track-bytes');assert.equal(downloads,1,'reload reuses IndexedDB without downloading');
 console.log('MCP music persists across reloads without a second download.');
}finally{await browser.close();}
