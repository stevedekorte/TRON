#!/usr/bin/env python3
"""Rebuild only Clu's steady engine loop, excluding the louder onset/tail."""
import array, json, math, pathlib, subprocess, tempfile, wave
source=pathlib.Path('docs/references/videos/1982 tron clu scene.mp4')
rate=44100
start,duration=10.99,.38
filters='highpass=f=65,lowpass=f=650,equalizer=f=330:t=q:w=4:g=-18'
with tempfile.TemporaryDirectory() as tmp:
    cut=pathlib.Path(tmp)/'engine.wav'
    subprocess.run(['ffmpeg','-v','error','-y','-ss',str(start),'-t',str(duration),'-i',str(source),'-vn','-af',filters,'-ar',str(rate),'-ac','2','-c:a','pcm_s16le',str(cut)],check=True)
    with wave.open(str(cut)) as w: raw=array.array('h',w.readframes(w.getnframes()))
samples=[[raw[i]/32768,raw[i+1]/32768] for i in range(0,len(raw),2)]
# Gentle shared stereo envelope leveling before the overlap. It removes the
# repeating volume accent without independently pumping the two channels.
energy=[sum(v*v for v in frame)/2 for frame in samples]
prefix=[0]
for v in energy: prefix.append(prefix[-1]+v)
window=int(rate*.035)
for i,frame in enumerate(samples):
    lo=max(0,i-window);hi=min(len(samples),i+window)
    rms=math.sqrt((prefix[hi]-prefix[lo])/(hi-lo))
    gain=min(1.5,max(.67,.15/max(.001,rms)))
    samples[i]=[v*gain for v in frame]
overlap=int(rate*.1)
head=samples[:overlap];body=samples[overlap:]
for i in range(overlap):
    t=i/(overlap-1);weight=.5-.5*math.cos(math.pi*t)
    body[-overlap+i]=[body[-overlap+i][c]*(1-weight)+head[i][c]*weight for c in range(2)]
# Preserve the old overall loudness rather than peak-normalizing the quieter cut.
rms=math.sqrt(sum(v*v for frame in body for v in frame)/(2*len(body)))
gain=.16/rms
pcm=array.array('h',(round(max(-1,min(1,v*gain))*32767) for frame in body for v in frame))
with wave.open('public/audio/tank-drive.wav','wb') as w:
    w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm.tobytes())
manifest_path=pathlib.Path('public/audio/sources.json');manifest=json.loads(manifest_path.read_text())
for sample in manifest['samples']:
    if sample['name']=='tank-drive': sample.update(source=str(source),source_seek=start,start=start,source_duration=duration,duration=len(body)/rate,filters=filters,loop_crossfade_seconds=.1,processing='Shared stereo 70 ms RMS envelope leveling; steady interior cut; rebuild with scripts/smooth-tank-loop.py')
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Engine loop: {len(body)/rate:.3f}s, RMS {rms*gain:.3f}, peak {max(abs(v) for v in pcm)/32768:.3f}')
