import fs from 'node:fs';
// Exact whole cycles over sixteen seconds: no loop crossfade or amplitude pumping.
const rate=44100,duration=16,frames=rate*duration;
const channels=[new Float32Array(frames),new Float32Array(frames)];
let seed=1982;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const tones=[[36,.32],[48,.23],[60,.16],[72,.13],[96,.08],[120,.045],[144,.025]];
// Quiet, diffuse machinery texture above the stable bass foundation.
for(let j=0;j<96;j++)tones.push([Math.round((80+random()*440)*duration)/duration,.005*(1-j/140)]);
for(const [hz,amplitude] of tones){
 const phase=random()*Math.PI*2,stereo=hz<80?.05:random()*.8;
 for(let c=0;c<2;c++)for(let i=0;i<frames;i++)channels[c][i]+=amplitude*Math.sin(Math.PI*2*hz*i/rate+phase+c*stereo);
}
let peak=0;for(const ch of channels)for(const v of ch)peak=Math.max(peak,Math.abs(v));
const gain=.65/peak,bytes=frames*4,wav=Buffer.alloc(44+bytes);
wav.write('RIFF');wav.writeUInt32LE(36+bytes,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(bytes,40);
for(let i=0;i<frames;i++)for(let c=0;c<2;c++)wav.writeInt16LE(Math.round(channels[c][i]*gain*32767),44+i*4+c*2);
fs.writeFileSync('public/audio/carrier-drone.wav',wav);
const rms=[];
for(let start=0;start<frames;start+=rate/4){let power=0;for(let i=start;i<start+rate/4;i++)power+=(channels[0][i]*gain)**2;rms.push(Math.sqrt(power/(rate/4)));}
const variation=Math.max(...rms)/Math.min(...rms);
const seam=Math.max(...channels.map(ch=>Math.abs(ch[0]-ch[frames-1])*gain));
if(variation>1.1||seam>.01)throw Error(`Unsteady loop: RMS ratio ${variation}, seam ${seam}`);
console.log(`16s stereo drone; peak 0.65, quarter-second RMS ratio ${variation.toFixed(3)}, loop seam ${seam.toFixed(5)}.`);
