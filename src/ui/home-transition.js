// Render terminal copies above the scene so their fades survive mode changes.
export const HOME_TRANSITION={otherTextMs:825,selectedTextMs:1100,blinkCount:3,blinkPhaseMs:99/1.3,finalFadeMs:140};
const blinkStart=HOME_TRANSITION.selectedTextMs-HOME_TRANSITION.finalFadeMs-2*HOME_TRANSITION.blinkCount*HOME_TRANSITION.blinkPhaseMs;
const SELECTED_FRAMES=[
  {opacity:1,offset:0},
  {opacity:.8,offset:(blinkStart-1)/HOME_TRANSITION.selectedTextMs,easing:'steps(1,end)'},
  ...Array.from({length:2*HOME_TRANSITION.blinkCount},(_,i)=>({opacity:i%2,offset:(blinkStart+i*HOME_TRANSITION.blinkPhaseMs)/HOME_TRANSITION.selectedTextMs,easing:'steps(1,end)'})),
  {opacity:1,offset:1-HOME_TRANSITION.finalFadeMs/HOME_TRANSITION.selectedTextMs},{opacity:0,offset:1},
];
export function createHomeTransition(){
  let active=false,curtain=null,animations=[],sceneAnimations=[],waitingForScene=false,startedAt=0;
  function clear(){
    animations.forEach(a=>a.cancel());animations=[];sceneAnimations=[];
    curtain?.remove();curtain=null;active=false;waitingForScene=false;
    document.body.classList.remove('home-opening');
  }
  function copy(element,id){
    const rect=element.getBoundingClientRect(),style=getComputedStyle(element);
    const clone=element.tagName==='IMG'?element.cloneNode():document.createElement('div');
    clone.id=id;clone.removeAttribute('class');
    if(element.tagName!=='IMG')clone.textContent=element.textContent.trim();
    Object.assign(clone.style,{position:'absolute',left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,margin:'0',padding:'0',font:style.font,letterSpacing:style.letterSpacing,color:style.color,textShadow:style.textShadow,whiteSpace:style.whiteSpace,textTransform:'uppercase',opacity:style.opacity,filter:style.filter});
    curtain.append(clone);return clone;
  }
  function animate(element,frames,options,{sceneDependent=true}={}){
    const animation=element.animate(frames,{fill:'forwards',...options});
    animations.push(animation);if(sceneDependent)sceneAnimations.push(animation);
    if(waitingForScene&&sceneDependent){animation.pause();animation.currentTime=0;}
    return animation;
  }
  return {
    get active(){return active;},
    async begin(button,{waitForScene=false,preparedScene=false,coverUntilSceneReady=false,keepCovered=false}={}){
      active=true;waitingForScene=waitForScene;startedAt=performance.now();
      const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      const first=reduced?0:HOME_TRANSITION.otherTextMs,last=reduced?0:HOME_TRANSITION.selectedTextMs;
      curtain=document.createElement('div');curtain.id='home-transition';
      curtain.dataset.selectedFadeAt=String(Date.now()+first);
      curtain.dataset.fadeDuration=String(last);
      curtain.dataset.backgroundDuration=String(first);
      curtain.dataset.blinkFrames=JSON.stringify(SELECTED_FRAMES);
      Object.assign(curtain.style,{position:'fixed',inset:'0',zIndex:'1000',pointerEvents:'none'});
      const background=document.createElement('div');background.id='home-transition-background';
      Object.assign(background.style,{position:'absolute',inset:'0',background:'#020204'});
      curtain.append(background);document.body.append(curtain);
      // A different game must replace the home preview before it can be revealed.
      if(!keepCovered)animate(background,[{opacity:1},{opacity:0}],{duration:first,easing:'linear'},{sceneDependent:coverUntilSceneReady});
      const label=copy(button,'home-selected-label');label.style.whiteSpace='pre';
      const marker=document.createElement('span');marker.id='home-selection-cursor';
      Object.assign(marker.style,{display:'inline-block',width:'.48em',height:'.78em',background:'currentColor',marginRight:'1ch'});
      label.prepend(marker);
      animate(label,reduced?[{opacity:1},{opacity:0}]:SELECTED_FRAMES,{delay:first,duration:last});
      const others=[marker];
      for(const element of document.querySelectorAll('#intro .terminal-copy,.terminal-encom,#game-menu button')){
        if(element===button||!element.getClientRects().length)continue;
        const clone=copy(element,'');clone.dataset.homeOther='';
        if(element.tagName==='BUTTON')clone.style.paddingLeft='calc(.48em + 1ch)';
        others.push(clone);
      }
      const otherAnimations=others.map(element=>animate(element,[{opacity:getComputedStyle(element).opacity},{opacity:0}],{duration:first,easing:'linear'},{sceneDependent:coverUntilSceneReady}));
      document.body.classList.add('home-opening');
      // Start the prepared game before the first frame of the dissolve.
      if(waitForScene){
        if(!preparedScene)await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        return;
      }
      await Promise.all(otherAnimations.map(a=>a.finished.catch(()=>{})));
      if(!active)return;
      marker.style.opacity='0';
      curtain.querySelectorAll('[data-home-other]').forEach(e=>e.remove());
    },
    sceneReady(){
      if(!waitingForScene)return;
      waitingForScene=false;
      // When replacing the preview, reveal the new scene and dissolve the other
      // text on one timeline, rather than consuming the text fade during setup.
      const covered=sceneAnimations.some(a=>a.effect.target.id==='home-transition-background');
      const remainingFirst=covered?Number(curtain.dataset.backgroundDuration):Math.max(0,HOME_TRANSITION.otherTextMs-(performance.now()-startedAt));
      curtain.dataset.selectedFadeAt=String(Date.now()+remainingFirst);
      // Resolve a fresh animation start after rendering; the frame timestamp can
      // still precede synchronous shader preparation.
      for(const animation of sceneAnimations){
        const timing=animation.effect.getTiming();
        if(timing.duration>0&&animation.effect.target.id==='home-selected-label')animation.effect.updateTiming({delay:remainingFirst});
        animation.currentTime=0;animation.play();
      }
    },
    async finish(){
      await Promise.all(sceneAnimations.map(a=>a.finished.catch(()=>{})));
      clear();
    },
    clear,
  };
}
