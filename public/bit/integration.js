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
window.addEventListener('keydown', event => {
  if (['Enter','Space'].includes(event.code) && !window.VizApp?._didBegin) {
    event.preventDefault();if(!event.repeat)window.VizApp?.activate();return;
  }
  if (event.code !== 'Escape') return;
  event.preventDefault();event.stopImmediatePropagation();
  if (event.repeat) return;
  stopBit();
  window.location.replace(new URL('../', window.location.href).href);
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
