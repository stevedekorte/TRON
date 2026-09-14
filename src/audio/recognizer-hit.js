// Original synthetic armor impact: noisy electrical snap, low body and a short
// inharmonic ring. No film music/dialogue; shared synthesis for WAV and fallback.
export const RECOGNIZER_HIT={duration:.3,peak:.72,gain:.7,minRate:.94,maxRate:1.06};
export function recognizerHitSamples(rate=44100){
 const channels=[new Float32Array(Math.ceil(rate*RECOGNIZER_HIT.duration)),new Float32Array(Math.ceil(rate*RECOGNIZER_HIT.duration))];
 let seed=1982,low=0,previous=0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
 for(let i=0;i<channels[0].length;i++){
  const t=i/rate,noise=random();low+=.18*(noise-low);
  const snap=(noise-previous)*Math.exp(-t/ .017);previous=noise;
  const body=Math.sin(2*Math.PI*(155*t+2.8*(1-Math.exp(-t/.018))))*Math.exp(-t/.045);
  const zap=Math.sin(2*Math.PI*(620*t+16*(1-Math.exp(-t/.014)))+2.4*Math.sin(2*Math.PI*173*t)*Math.exp(-t/.025))*Math.exp(-t/.035);
  const envelope=Math.min(1,t/.0015)*Math.min(1,(RECOGNIZER_HIT.duration-t)/.035);
  for(let c=0;c<2;c++){
   const ring=[[930,1],[1471,.52],[2243,.23]].reduce((sum,[frequency,weight])=>sum+weight*Math.sin(2*Math.PI*frequency*(1+c*.0018)*t)*Math.exp(-t/(.047+weight*.019)),0);
   channels[c][i]=envelope*(snap*.22+low*Math.exp(-t/.04)*.55+body*.36+zap*.22+ring*.18);
  }
 }
 let peak=0;for(const a of channels)for(const v of a)peak=Math.max(peak,Math.abs(v));
 for(const a of channels)for(let i=0;i<a.length;i++)a[i]*=RECOGNIZER_HIT.peak/peak;
 return channels;
}
