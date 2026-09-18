// Short electronic armor strike: pressure thump, saturated crack and a falling
// electrical tail. No sustained metallic resonators (the old bucket-like ring).
export const RECOGNIZER_HIT={duration:.48,peak:.82,gain:.8,minRate:.94,maxRate:1.04};
export function recognizerHitSamples(rate=44100,kind='recognizer',variant=0){
 const duration=kind==='tank'?.36:RECOGNIZER_HIT.duration;
 const channels=[new Float32Array(Math.ceil(rate*duration)),new Float32Array(Math.ceil(rate*duration))];
 let seed=1982+variant*7919,low=0,mid=0,phase=0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
 const size=kind==='tank'?1.25:1;
 for(let i=0;i<channels[0].length;i++){
  const t=i/rate,noise=random();low+=.025*(noise-low);mid+=.22*(noise-mid);
  const frequency=(48+130*Math.exp(-t/.018))*size;phase+=2*Math.PI*frequency/rate;
  const thump=Math.sin(phase)*Math.exp(-t/.095);
  const crack=Math.tanh((noise-mid)*2.8)*Math.exp(-t/.024);
  const pressure=low*4*Math.exp(-t/.12);
  const envelope=Math.min(1,t/.001)*Math.min(1,(duration-t)/.045);
  for(let c=0;c<2;c++){
   const tail=Math.sin(2*Math.PI*(105*size*t+17*(1-Math.exp(-t/.038)))+noise*.9+c*.07)*Math.exp(-t/.075);
   channels[c][i]=envelope*Math.tanh(thump*.85+pressure*.65+crack*.55+tail*.25);
  }
 }
 let peak=0;for(const a of channels)for(const v of a)peak=Math.max(peak,Math.abs(v));
 for(const a of channels)for(let i=0;i<a.length;i++)a[i]*=RECOGNIZER_HIT.peak/peak;
 return channels;
}
