// Original electronic tank destruction: low shock, electrical rupture and
// scattered chassis fragments. No dialogue or music from a mixed film stem.
export const TANK_EXPLOSION={duration:1.65,peak:.84,gain:.85,refDistance:42,minRate:.94,maxRate:1.04,variants:3};
export function tankExplosionSamples(rate=44100,variant=0){
 const frames=Math.ceil(rate*TANK_EXPLOSION.duration),channels=[new Float32Array(frames),new Float32Array(frames)];
 let seed=198209+variant*7919,low=0,air=0,previous=0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const fragments=Array.from({length:9},(_,i)=>({start:.075+i*.054+random()*.055,frequency:280+random()*1500,decay:.045+random()*.09,pan:random(),weight:.07+random()*.09}));
 const lowAlpha=1-Math.exp(-2*Math.PI*160/rate),airAlpha=1-Math.exp(-2*Math.PI*2600/rate);
 for(let i=0;i<frames;i++){
  const t=i/rate,noise=random()*2-1;low+=lowAlpha*(noise-low);air+=airAlpha*(noise-air);
  const shock=Math.sin(2*Math.PI*(43*t+4.2*(1-Math.exp(-t/.055))))*Math.exp(-t/.19);
  const rupture=Math.sin(2*Math.PI*(110*t+22*(1-Math.exp(-t/.035)))+3*Math.sin(2*Math.PI*79*t)*Math.exp(-t/.1))*Math.exp(-t/.12);
  const crack=(air-previous)*Math.exp(-t/.025);previous=air;
  const blast=low*2.5*Math.exp(-t/.31)+air*.48*Math.exp(-t/.13);
  const envelope=Math.min(1,t/.0015)*Math.min(1,(TANK_EXPLOSION.duration-t)/.15);
  for(let c=0;c<2;c++){
   let debris=0;
   for(const f of fragments){
    const age=t-f.start;if(age<0)continue;
    const pan=c?f.pan:1-f.pan;
    debris+=f.weight*Math.sqrt(pan)*Math.min(1,age/.002)*Math.exp(-age/f.decay)*(Math.sin(2*Math.PI*f.frequency*age)+.4*Math.sin(2*Math.PI*f.frequency*1.617*age));
   }
   channels[c][i]=envelope*(shock*.58+rupture*.2+crack*.65+blast+debris);
  }
 }
 let peak=0;for(const channel of channels)for(const v of channel)peak=Math.max(peak,Math.abs(v));
 for(const channel of channels)for(let i=0;i<frames;i++)channel[i]*=TANK_EXPLOSION.peak/peak;
 return channels;
}
