// Static access text; the opening dissolve is handled by the main view.
export class Terminal {
 constructor(text,actions){this.text=text;this.actions=actions;this.done=true;}
 finish(){this.done=true;this.actions.hidden=false;this.text.parentElement.classList.add('complete');}
}

// Driven by the frame loop, including pauses/fades: restart leaves no timers.
export class TerminalTribute {
 constructor(element,message){
  this.element=element;this.output=element.querySelector('#tribute-text');
  this.typed=element.querySelector('.tribute-typed');
  this.message=message.replace(/\r\n?/g,'\n').replace(/\n+$/,'').replace(/\nEND OF LINE$/,'');
  element.querySelector('.tribute-measure').textContent=this.message+'\nEND OF LINE';
  this.sentences=this.message.split(/\n\n/);
  this.element.setAttribute('aria-label',this.message+'\nEND OF LINE');this.reset();
 }
 reset(){this.elapsed=0;this.nextCharacter=3;this.count=0;this.index=0;this.active=false;this.phase='body';this.output.textContent='';this.typed.style.opacity='1';this.element.classList.remove('complete','signing-off');}
 start(reducedMotion=false){this.reset();this.active=true;this.reducedMotion=reducedMotion;}
 update(dt,signOffReady=false){
  if(!this.active)return false;
  this.elapsed+=dt;
  if(this.phase==='body'){
   const message=this.sentences[this.index];
   if(this.reducedMotion&&this.elapsed>=this.nextCharacter)this.count=message.length;
   while(this.elapsed>=this.nextCharacter&&this.count<message.length){
    const character=message[this.count++];
    this.nextCharacter+=.045+Math.random()*.10+(character==='\n'?.45:/[.!?]/.test(character)?.3:/[,;:]/.test(character)?.14:0);
   }
   this.output.textContent=message.slice(0,this.count);
   if(this.count<message.length)return false;
   this.phase=this.index===this.sentences.length-1?'waiting':'hold';this.phaseStarted=this.elapsed;this.element.classList.add('complete');
  }
  if(this.phase==='hold'){
   if(this.elapsed-this.phaseStarted<3)return false;
   this.phase='fade';this.phaseStarted=this.elapsed;
  }
  if(this.phase==='fade'){
   const fade=this.reducedMotion?1:Math.min(1,(this.elapsed-this.phaseStarted)/.8);
   this.typed.style.opacity=String(1-fade);
   if(fade<1)return false;
   this.output.textContent='';this.typed.style.opacity='1';this.element.classList.remove('complete');
   this.index++;this.count=0;
   this.phase=this.index<this.sentences.length?'body':'waiting';this.nextCharacter=this.elapsed+.4;
   return false;
  }
  if(this.phase==='waiting'){
   if(!signOffReady)return false;
   this.output.append(document.createTextNode('\n'));
   this.phase='return';this.nextCharacter=this.elapsed+.18;this.element.classList.remove('complete');return false;
  }
  if(this.phase==='return'&&this.elapsed>=this.nextCharacter){
   this.element.classList.add('signing-off');this.tail=document.createElement('span');this.tail.className='terminal-signoff';this.output.append(this.tail);
   this.phase='signoff';this.count=0;this.nextCharacter=this.elapsed+.18;
  }
  if(this.phase==='signoff'){
   const previous=this.count;
   while(this.elapsed>=this.nextCharacter&&this.count<11){this.count++;this.nextCharacter+=.055+Math.random()*.10;}
   if(this.reducedMotion)this.count=11;
   this.tail.textContent='END OF LINE'.slice(0,this.count);
   if(this.count===11){this.active=false;this.element.classList.add('complete');}
   return previous===0&&this.count>0;
  }
  return false;
 }
}

// Constant character cadence, including punctuation and line breaks.
export const VICTORY_PRINT=Object.freeze({charactersPerSecond:45});
export class TerminalPrinter {
 constructor(output,message,{clock=()=>performance.now()}={}){
  this.output=output;this.message=message.replace(/\r\n?/g,'\n').trimEnd();this.clock=clock;this.reset();
 }
 reset(){this.active=false;this.count=0;this.line=null;}
 start(){this.reset();this.startedAt=this.clock();this.nextCharacterAt=this.startedAt+1000/VICTORY_PRINT.charactersPerSecond;this.active=true;this.output.replaceChildren();}
 update(){
  if(!this.active)return;
  // Show at most one character per rendered frame; never dump a backlog as words.
  const now=this.clock(),interval=1000/VICTORY_PRINT.charactersPerSecond;
  if(now<this.nextCharacterAt)return;
  const count=Math.min(this.message.length,this.count+1);
  this.nextCharacterAt=Math.max(this.nextCharacterAt+interval,now);
  if(count<=this.count)return;
  const document=this.output.ownerDocument;
  for(const chunk of this.message.slice(this.count,count).split(/(\n)/)){
   if(!chunk)continue;
   if(chunk==='\n'){this.output.appendChild(document.createTextNode(chunk));this.line=null;continue;}
   if(!this.line){
    this.line=document.createElement('span');this.line.className='printer-line';
    this.output.appendChild(this.line);
   }
   // Immutable glyph nodes: never reshape an ever-growing text run.
   // No DOM geometry/computed-style reads in the printing path.
   const character=document.createElement('span');character.className='printer-character';
   character.appendChild(document.createTextNode(chunk));this.line.appendChild(character);
  }
  this.count=count;
  if(count===this.message.length)this.active=false;
 }
}
