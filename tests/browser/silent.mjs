// Keep automated browsers silent. Chrome and Firefox have mute switches;
// WebKit does not, so its Web Audio output is routed through a zero gain and
// media elements start muted (test pages only; the game is unchanged).
export const silentChromeArgs=['--mute-audio'];
export const silentFirefoxPrefs={'media.volume_scale':'0.0'};
export async function silence(context){
 await context.addInitScript(()=>{
  const base=globalThis.BaseAudioContext?.prototype,descriptor=base&&Object.getOwnPropertyDescriptor(base,'destination');
  if(descriptor?.get)Object.defineProperty(base,'destination',{configurable:true,get(){
   if(!this.__silentDestination){const real=descriptor.get.call(this),gain=this.createGain();gain.gain.value=0;gain.connect(real);
    for(const key of ['maxChannelCount'])Object.defineProperty(gain,key,{value:real[key]});this.__silentDestination=gain;}
   return this.__silentDestination;}});
  const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){this.muted=true;return play.apply(this,args);};
 });
}
