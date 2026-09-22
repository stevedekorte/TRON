// Original procedural effect: phase collapse, digital snap, then resonant reassembly.
export const TELEPORT_SOUND=Object.freeze({departureSeconds:.28,arrivalSeconds:.62,playerSeconds:.78,gain:.65,refDistance:28,lowHz:360,highHz:1850,attackSeconds:.008,echoSeconds:.037});
export function teleportSamples(sampleRate,phase='arrival'){
 const player=phase==='player',departure=phase==='departure',duration=player?TELEPORT_SOUND.playerSeconds:departure?TELEPORT_SOUND.departureSeconds:TELEPORT_SOUND.arrivalSeconds;
 const count=Math.ceil(sampleRate*duration),channels=[new Float32Array(count),new Float32Array(count)];
 let carrier=0,modulator=0,seed=1982,noise=0;
 for(let i=0;i<count;i++){
  const t=i/sampleRate,u=t/duration,collapse=departure||player&&t<.16;
  const sweep=collapse?Math.min(1,t/(player?.16:duration)):Math.min(1,(t-(player?.16:0))/(duration-(player?.16:0)));
  const frequency=collapse?TELEPORT_SOUND.highHz*Math.pow(TELEPORT_SOUND.lowHz/TELEPORT_SOUND.highHz,sweep):TELEPORT_SOUND.lowHz*Math.pow(TELEPORT_SOUND.highHz/TELEPORT_SOUND.lowHz,sweep);
  carrier+=2*Math.PI*frequency/sampleRate;modulator+=2*Math.PI*(collapse?127:211)/sampleRate;
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;noise=.6*noise+.4*(seed/2147483648-1);
  const envelope=Math.min(1,t/TELEPORT_SOUND.attackSeconds)*Math.pow(1-u,2)*Math.min(1,(duration-t)/.025);
  for(let c=0;c<2;c++){
   const tone=Math.sin(carrier+Math.sin(modulator+c*.19)*2.1)*.45+Math.sin(carrier*1.503+c*.13)*.13;
   const snap=noise*.15*Math.exp(-t*28),echoIndex=i-Math.round(sampleRate*TELEPORT_SOUND.echoSeconds*(c?1.1:1));
   channels[c][i]=(tone*.75+snap)*envelope+(echoIndex>=0?channels[c][echoIndex]*.18*(1-u):0);
  }
 }
 return channels;
}
