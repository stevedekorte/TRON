// Keep the selected label at its home-menu position while the scene opens.
export const HOME_TRANSITION = {otherTextMs:825,selectedTextMs:1100};
export function createHomeTransition(){
  let active=false,curtain=null,sceneFade=null,animations=[],waitingForScene=false,otherTextGone=false;
  const animate=async(element,frames,duration,easing='ease-in-out')=>{
    const animation=element.animate(frames,{duration,fill:'forwards',easing});
    animations.push(animation);
    await animation.finished.catch(()=>{});
  };
  function clear(){
    animations.forEach(a=>a.cancel());animations=[];
    curtain?.remove();curtain=null;sceneFade=null;active=false;
    waitingForScene=false;otherTextGone=false;
    document.body.classList.remove('home-opening');
  }
  return {
    get active(){return active;},
    async begin(button,{waitForScene=false}={}){
      active=true;
      waitingForScene=waitForScene;
      const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:HOME_TRANSITION.otherTextMs;
      const rect=button.getBoundingClientRect(),style=getComputedStyle(button);
      curtain=document.createElement('div');curtain.id='home-transition';
      curtain.dataset.selectedFadeAt=String(Date.now()+duration);
      curtain.dataset.fadeDuration=String(HOME_TRANSITION.selectedTextMs);
      Object.assign(curtain.style,{position:'fixed',inset:'0',zIndex:'1000',background:'transparent',pointerEvents:'none'});
      const label=document.createElement('div');label.id='home-selected-label';label.textContent=button.textContent.trim();
      Object.assign(label.style,{position:'absolute',left:`${rect.left}px`,top:`${rect.top}px`,font:style.font,letterSpacing:style.letterSpacing,color:style.color,textShadow:style.textShadow,whiteSpace:'pre',textTransform:'uppercase'});
      // Include the selection cursor without copying any interactive elements.
      const marker=document.createElement('span');marker.id='home-selection-cursor';marker.textContent='';
      Object.assign(marker.style,{display:'inline-block',width:'.48em',height:'.78em',background:'currentColor',marginRight:'1ch'});
      label.prepend(marker);curtain.append(label);document.body.append(curtain);
      // Create one shared background/label fade. Game starts release it after
      // their first rendered frame; document transitions keep the timed schedule.
      sceneFade=curtain.animate([{opacity:1},{opacity:0}],{
        delay:duration,duration:duration?HOME_TRANSITION.selectedTextMs:0,
        fill:'forwards',easing:'linear',
      });
      animations.push(sceneFade);
      // Game reset and first-frame shader work can outlast the fade. Keep the
      // curtain opaque until that frame exists, then reveal it for the full duration.
      if(waitingForScene){sceneFade.pause();sceneFade.currentTime=0;}
      const hideOriginal=button.animate([{opacity:0},{opacity:0}],{duration:0,fill:'forwards'});
      animations.push(hideOriginal);
      await Promise.all([marker,...document.querySelectorAll('#intro .terminal-copy,.terminal-encom,#game-menu button')]
        .filter(e=>e!==button&&e.getClientRects().length).map(e=>animate(e,[{opacity:getComputedStyle(e).opacity},{opacity:0}],duration)));
      if(!active)return;
      marker.style.opacity='0';
      curtain.style.background='#020204';
      otherTextGone=true;
      document.body.classList.add('home-opening');
    },
    sceneReady(){
      if(!waitingForScene||!otherTextGone||!sceneFade)return;
      waitingForScene=false;
      sceneFade.currentTime=sceneFade.effect.getTiming().delay;
      sceneFade.play();
    },
    async finish(){
      if(sceneFade)await sceneFade.finished.catch(()=>{});
      clear();
    },
    clear,
  };
}
