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
