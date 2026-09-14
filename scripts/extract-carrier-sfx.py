#!/usr/bin/env python3
"""Prepare a stereo rumble candidate from the supplied mixed film soundtrack."""
import subprocess,wave,array,math,json,pathlib,tempfile,hashlib
source=pathlib.Path('docs/references/videos/carrier and solar sailer.mp4')
out=pathlib.Path('public/audio');start=116.2;duration=4.0;rate=44100
filters='highpass=f=35,lowpass=f=900'
with tempfile.TemporaryDirectory() as tmp:
 path=pathlib.Path(tmp)/'carrier.wav'
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(start),'-t',str(duration),'-i',str(source),'-vn','-af',filters,'-ar',str(rate),'-ac','2',str(path)],check=True)
 with wave.open(str(path)) as f:raw=array.array('h',f.readframes(f.getnframes()))
 samples=[[raw[i]/32768,raw[i+1]/32768] for i in range(0,len(raw),2)]
 for c in range(2):
  mean=sum(s[c] for s in samples)/len(samples)
  for s in samples:s[c]-=mean
 n=int(rate*.4);head=samples[:n];samples=samples[n:]
 for i in range(n):
  w=.5-.5*math.cos(math.pi*i/(n-1))
  samples[-n+i]=[samples[-n+i][c]*(1-w)+head[i][c]*w for c in range(2)]
 peak=max(abs(v) for s in samples for v in s);gain=.65/max(.001,peak)
 pcm=array.array('h',(round(v*gain*32767) for s in samples for v in s))
 with wave.open(str(out/'carrier-rumble.wav'),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(rate);f.writeframes(pcm.tobytes())
(out/'carrier-source.json').write_text(json.dumps({'source':str(source),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'start':start,'end':start+duration,'filters':filters,'crossfade_seconds':.4,'duration':len(samples)/rate,'channels':2,'note':'Mixed film soundtrack, not an isolated carrier stem. Auditory approval pending.'},indent=2)+'\n')
print('Wrote 3.6-second stereo carrier loop, peak 0.65, with 0.4-second crossfade.')
