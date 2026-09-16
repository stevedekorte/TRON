import fs from 'node:fs';
import {tankExplosionSamples} from '../src/audio/tank-explosion.js';
const rate=44100,channels=tankExplosionSamples(rate),frames=channels[0].length,dataBytes=frames*4;
const wav=Buffer.alloc(44+dataBytes);wav.write('RIFF');wav.writeUInt32LE(36+dataBytes,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(dataBytes,40);
for(let i=0;i<frames;i++)for(let c=0;c<2;c++)wav.writeInt16LE(Math.round(channels[c][i]*32767),44+i*4+c*2);
fs.writeFileSync('public/audio/tank-explosion.wav',wav);
console.log('Generated 1.65-second stereo tank explosion audition.');
