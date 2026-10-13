// Live equivalent of the approved deeper/room audition. The saved audition is
// already processed and bypasses this graph. Pitch reduction also slows speech 8%.
export const MCP_VOICE_EFFECTS={pitchRatio:.92,wet:1.25,decaySeconds:.9,outputGain:.8,lowpassHz:2600};
export function createVoiceEffects(context){
 const c=MCP_VOICE_EFFECTS,input=context.createGain(),output=context.createGain(),wet=context.createGain(),room=context.createConvolver();
 const impulse=context.createBuffer(1,Math.ceil(context.sampleRate*c.decaySeconds),context.sampleRate),data=impulse.getChannelData(0);
 let seed=1982,filtered=0,energy=0;const alpha=1-Math.exp(-2*Math.PI*c.lowpassHz/context.sampleRate);
 for(let i=0;i<data.length;i++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;filtered+=alpha*(seed/2147483648-1-filtered);
  data[i]=i<context.sampleRate*.024?0:filtered*Math.exp(-6.9078*i/data.length);energy+=data[i]**2;
 }
 const scale=.24/Math.sqrt(energy||1);for(let i=0;i<data.length;i++)data[i]*=scale;
 for(const [ms,level] of [[31,.18],[47,.16],[71,.13],[109,.10],[163,.07],[241,.045],[353,.025]])data[Math.floor(ms*context.sampleRate/1000)]+=level;
 room.normalize=false;room.buffer=impulse;wet.gain.value=c.wet;output.gain.value=c.outputGain;
 input.connect(output);input.connect(room);room.connect(wet);wet.connect(output);output.connect(context.destination);
 return {input,dispose(){for(const node of [input,room,wet,output])node.disconnect();}};
}

// Bake the same approved graph into PCM, including the slowed pitch and full
// reverb tail. Cached playback is then a plain 1x source with no second effect pass.
export async function renderVoiceEffects({samples,sampleRate}){
 const frames=Math.ceil(samples.length/MCP_VOICE_EFFECTS.pitchRatio+sampleRate*MCP_VOICE_EFFECTS.decaySeconds);
 const context=new OfflineAudioContext(1,frames,sampleRate),buffer=context.createBuffer(1,samples.length,sampleRate);
 buffer.copyToChannel(samples,0);
 const source=context.createBufferSource();source.buffer=buffer;source.playbackRate.value=MCP_VOICE_EFFECTS.pitchRatio;
 const effects=createVoiceEffects(context);source.connect(effects.input);source.start();
 try{const rendered=await context.startRendering();return {samples:rendered.getChannelData(0),sampleRate:rendered.sampleRate,processed:true};}
 finally{source.disconnect();effects.dispose();}
}
