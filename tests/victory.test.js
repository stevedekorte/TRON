import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step} from '../src/simulation/run.js';
import {collectData} from '../src/simulation/data-beams.js';
import {TerminalPrinter,VICTORY_PRINT} from '../src/ui/terminal.js';
test('only all completed beams win, once; victory freezes the round and resets',()=>{
 const run=createRun(1982);run.dataBeams[0].collectedAt=0;collectData(run);assert.equal(run.won,false);
 run.dataBeams.forEach(b=>b.collectedAt=0);collectData(run);assert.equal(run.won,true);
 collectData(run);assert.equal(run.events.filter(e=>e.type==='victory').length,1);
 const before=structuredClone(run);step(run,{throttle:1,fire:true},1/60);assert.deepEqual(run,before);
 assert.equal(createRun(1982).won,false);
 const empty=createRun(1982);empty.dataBeams=[];collectData(empty);assert.equal(empty.won,false);
});
function printerOutput(){
 const document={createElement:()=>node(),createTextNode:text=>node(text)};
 function node(text=null){return {ownerDocument:document,children:[],data:text,
  get textContent(){return this.data??this.children.map(c=>c.textContent).join('');},
  replaceChildren(){this.children=[];},appendChild(child){this.children.push(child);},appendData(chunk){this.data+=chunk;}};}
 return node();
}
test('victory printer reveals individual characters without catch-up word bursts',()=>{
 const output=printerOutput(),text='A. B\n\n  C'.repeat(100);let now=0;
 const printer=new TerminalPrinter(output,text,{clock:()=>now});
 printer.start();
 for(let frame=1;frame<=120;frame++){
  now=frame*1000/60;const before=output.textContent.length;printer.update(.1);
  assert.ok(output.textContent.length-before<=1);
 }
 assert.ok(Math.abs(output.textContent.length-2*VICTORY_PRINT.charactersPerSecond)<=1);
 const firstLine=output.children[0],savedText=firstLine.textContent,before=output.textContent.length;
 now+=2000;printer.update(.1);assert.equal(output.textContent.length,before+1);
 for(let frame=0;frame<2000;frame++){now+=1000/60;printer.update();}
 assert.equal(output.children[0],firstLine);assert.equal(firstLine.textContent,savedText);
 assert.equal(output.textContent,text);assert.equal(printer.active,false);
 for(const line of output.children.filter(n=>n.className==='printer-line')){
  for(const glyph of line.children){assert.equal(glyph.className,'printer-character');assert.equal(glyph.textContent.length,1);}
 }
 printer.start();assert.equal(output.textContent,'');printer.reset();now+=10000;printer.update();assert.equal(output.textContent,'');
});

test('human terminal printing varies keystrokes, pauses at line breaks, and never bursts after a stall',async()=>{
 const {HumanTerminalPrinter}=await import('../src/ui/terminal.js');
 const output=printerOutput();let now=0,index=0;
 const printer=new HumanTerminalPrinter(output,'A\nB',{clock:()=>now,random:()=>[0,.5,1][index++%3]});
 printer.start();const first=printer.nextCharacterAt;assert.equal(first,22.5);
 now=first;printer.update();assert.equal(output.textContent,'A');
 assert.equal(printer.nextCharacterAt-now,47.5);
 now=printer.nextCharacterAt;printer.update();assert.equal(output.textContent,'A\n');
 assert.equal(printer.nextCharacterAt-now,247.5);
 now+=20000;printer.update();assert.equal(output.textContent,'A\nB');assert(!printer.active);
 printer.start();printer.reset();now+=20000;printer.update();assert.equal(output.textContent,'');
});

test('extended credits keep one entry per page and omit URLs, including inline links',async()=>{
 const {creditPages}=await import('../src/ui/terminal.js');
 const text='MODEL ARTISTS\n-------------\n\nArtist A\n  Model One\n  https://example.com/one\n  MIT. https://example.com/license\n\n  Model Two\n  Adapted by the same artist.\n\nArtist B\n  Model Three\n\nProject source repository:\nhttps://example.com/repo\n\na@1.0 — MIT\nb@2.0 — ISC';
 const pages=creditPages(text);
 assert.deepEqual(pages,['MODEL ARTISTS','Artist A\n  Model One\n  MIT.','Artist A\n  Model Two\n  Adapted by the same artist.','Artist B\n  Model Three','a@1.0 — MIT','b@2.0 — ISC']);
});

test('display credits keep a brief Cloudflare mention and no entry exceeds eight lines',async()=>{
 const {creditPages}=await import('../src/ui/terminal.js');
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../docs/credits_display.txt',import.meta.url),'utf8');
 const pages=creditPages(source),display=pages.join('\n');
 assert(display.includes('DANIEL PRETI'));assert(display.includes('THREE.JS'));
 assert.equal(pages.find(p=>p.startsWith('CLOUDFLARE')).split('\n').length,2);
 assert(!/wrangler|NPM DEPENDENCY INVENTORY|https?:\/\//i.test(display));
 assert(pages.every(p=>p.split('\n').length<=8&&p.split('\n').every(line=>line.length<=60)));
 assert(pages.length<30);
});
