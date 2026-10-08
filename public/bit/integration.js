// Full-document navigation isolates the legacy renderer and releases its resources.
function stopBit() {
  window.bitLeaving = true;
  for (const bit of window.VizApp?._objects || []) {
    bit._request?.abort();
    clearTimeout(bit._answerFadeTimer);
    if (bit._recognition) {
      bit._recognition.onend = null;
      bit._recognition.onresult = null;
      bit._recognition.abort();
    }
  }
  window.BitSound?.context?.close().catch(() => {});
}
const exitConfirm=window.createExitConfirm({
  onConfirm:()=>{stopBit();window.location.replace(new URL('../',window.location.href).href);},
  onCancel:()=>{
    window.bitPaused=false;
    window.BitSound?.context?.resume().catch(()=>{});
    for(const bit of window.VizApp?._objects||[])bit.resumeListening?.();
  },
});
window.addEventListener('keydown', event => {
  if(exitConfirm.open)return;
  if (['Enter','Space'].includes(event.code) && !window.VizApp?._didBegin) {
    event.preventDefault();if(!event.repeat)window.VizApp?.activate();return;
  }
  if (event.code !== 'Escape') return;
  event.preventDefault();event.stopImmediatePropagation();
  if (event.repeat) return;
  window.bitPaused=true;
  for(const bit of window.VizApp?._objects||[]){
    bit._request?.abort();
    bit.pauseListening?.(()=>{});
  }
  window.BitSound?.context?.suspend().catch(()=>{});
  exitConfirm.show();
}, true);
window.addEventListener('pagehide', stopBit, {once:true});

// Selecting Bit is the start action; request microphone access on entry.
window.addEventListener('DOMContentLoaded', async () => {
  const instructions = document.getElementById('instructions');
  const showPrompt = message => {
    if (window.bitLeaving || VizApp._didBegin) return;
    if (message) instructions.textContent = message;
    document.body.classList.add('bit-ready','awaiting-microphone');
  };
  const launch = () => {
    if (window.bitLeaving) return;
    document.body.classList.remove('awaiting-microphone');
    document.body.classList.add('bit-ready');
    VizApp.beginIfNeeded();
  };
  let requesting = false;
  VizApp.activate = async () => {
    if (VizApp._didBegin) {VizApp.unlockAnswerSounds();return;}
    if (requesting || window.bitLeaving) return;
    requesting = true;
    // Try playback unlock immediately; a later retry gesture can unlock it too.
    VizApp.unlockAnswerSounds();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      stream.getTracks().forEach(track => track.stop());
      launch();
    } catch {
      showPrompt('ALLOW MICROPHONE ACCESS, THEN PRESS ENTER TO RETRY');
    } finally {requesting = false;}
  };
  try {
    const permission = await navigator.permissions.query({name:'microphone'});
    if (permission.state === 'granted') {launch();return;}
  } catch { /* Permission queries are optional; request the microphone directly. */ }
  showPrompt('REQUESTING MICROPHONE ACCESS');
  void VizApp.activate();
}, {once:true});

// Center the current heading's measured width, preserving the shared left edge.
window.addEventListener('DOMContentLoaded', () => {
  const heading = document.getElementById('instructions');
  const controls = document.getElementById('controls');
  const centerHeading = () => {
    const range = document.createRange();
    range.selectNodeContents(heading);
    controls.style.setProperty('--bit-heading-width', `${range.getBoundingClientRect().width}px`);
  };
  const observer = new MutationObserver(centerHeading);
  observer.observe(heading, {childList:true, characterData:true, subtree:true});
  window.addEventListener('resize', centerHeading);
  document.fonts.ready.then(centerHeading);
  centerHeading();
  window.addEventListener('pagehide', () => {
    observer.disconnect();window.removeEventListener('resize', centerHeading);
  }, {once:true});
}, {once:true});

// Carry the selected home label across the standalone BIT document navigation.
window.addEventListener('DOMContentLoaded',()=>{
  let saved;
  try{saved=sessionStorage.getItem('tron-home-transition');sessionStorage.removeItem('tron-home-transition');}catch{}
  if(!saved)return;
  const template=document.createElement('template');template.innerHTML=saved;
  const curtain=template.content.firstElementChild;
  if(curtain?.id!=='home-transition')return;
  document.body.append(curtain);
  function reveal(){
    const duration=Number(curtain.dataset.fadeDuration)||1100;
    const elapsed=Math.max(0,Date.now()-Number(curtain.dataset.selectedFadeAt||Date.now()));
    const remaining=Math.max(0,duration-elapsed);
    curtain.animate([{opacity:remaining/duration},{opacity:0}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:remaining,easing:'linear',fill:'forwards'}).finished.finally(()=>curtain.remove());
  }
  document.fonts.ready.then(()=>requestAnimationFrame(reveal));
},{once:true});
