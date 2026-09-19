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
