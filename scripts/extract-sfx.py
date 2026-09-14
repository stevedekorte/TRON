#!/usr/bin/env python3
"""Rebuild short film-derived sound studies from the user-supplied local video."""
import subprocess, wave, array, math, json, pathlib, tempfile, hashlib
source=pathlib.Path('docs/references/videos/1982 tron clu scene.mp4')
audio_source=source.with_suffix('.m4a')
# The supplied M4A decodes identically after 2112 trimmed video-audio frames.
audio_offset=2112/44100
out=pathlib.Path('public/audio');out.mkdir(exist_ok=True)
# Times are in the local 187.48-second file, not the earlier YouTube metadata.
cuts=[('tank-drive',10.75,.7,True,65,650),('recognizer-flight',124,2,True,45,6500),('recognizer-approach',126.2,2.2,True,45,6500),('cannon',121.38,.38,False,65,12000)]
cuts += [('recognizer-explosion',107.84,.85,False,45,12000)]
cuts += [(f'terminal-key-{i+1}',start,.060,False,150,6500) for i,start in enumerate([.885,1.395,.995,1.585])]
manifest={'source':str(source),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'origin':'User-supplied TRON (1982) film scene; mixed soundtrack, not isolated production stems','samples':[]}
for name,start,duration,loop,hp,lp in cuts:
 selected=audio_source if name.startswith('recognizer-') and audio_source.exists() else source
 selected_start=start-audio_offset if selected==audio_source else start
 with tempfile.TemporaryDirectory() as tmp:
  wav=pathlib.Path(tmp)/'cut.wav'
  filters=f'highpass=f={hp},lowpass=f={lp}'
  if name=='tank-drive':filters+=',equalizer=f=330:t=q:w=4:g=-18'
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(selected_start),'-t',str(duration),'-i',str(selected),'-vn','-af',filters,'-ar','44100','-ac','2','-c:a','pcm_s16le',str(wav)],check=True)
  with wave.open(str(wav)) as f: rate=f.getframerate();raw=array.array('h',f.readframes(f.getnframes()))
  samples=[[raw[i]/32768,raw[i+1]/32768] for i in range(0,len(raw),2)]
  # Remove DC per channel and crossfade both channels together.
  for c in range(2):
   mean=sum(s[c] for s in samples)/len(samples)
   for s in samples:s[c]-=mean
  overlap=int(rate*.12)
  if loop:
   head=samples[:overlap];body=samples[overlap:]
   for i in range(overlap):
    t=i/(overlap-1);weight=.5-.5*math.cos(math.pi*t)
    body[-overlap+i]=[body[-overlap+i][c]*(1-weight)+head[i][c]*weight for c in range(2)]
   samples=body
  else:
   for i,s in enumerate(samples):
    gain=min(1,i/(rate*.003),(len(samples)-1-i)/(rate*.07))
    if name.startswith('terminal-key-'):
     release=min(1,max(0,(len(samples)-1-i)/(rate*.030)))
     gain=min(1,i/(rate*.002))*release*release*(3-2*release)*math.exp(-max(0,i/rate-.022)/.020)
    samples[i]=[v*max(0,gain) for v in s]
  peak=max(abs(v) for s in samples for v in s);gain=.72/max(.001,peak)
  pcm=array.array('h',(round(max(-1,min(1,v*gain))*32767) for s in samples for v in s))
  dest=out/(name+'.wav')
  with wave.open(str(dest),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(rate);f.writeframes(pcm.tobytes())
  manifest['samples'].append({'name':name,'source':str(selected),'source_seek':selected_start,'file':dest.name,'start':start,'source_duration':duration,'duration':len(samples)/rate,'loop':loop,'channels':2,'filters':filters,'loop_crossfade_seconds':.12 if loop else 0})
(out/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest['samples'],indent=2))
