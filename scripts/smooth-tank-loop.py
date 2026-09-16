#!/usr/bin/env python3
"""Make a steady engine bed from the film sample's spectrum, without its transients.

A short waveform loop repeats every embedded knock. Instead, average its spectrum
and reconstruct a long periodic signal with deterministic, randomized phases.
This preserves the filtered engine's frequency balance without replaying impacts.
No third-party Python packages are required.
"""
import array, cmath, json, math, pathlib, random, subprocess, tempfile, wave
source=pathlib.Path('docs/references/videos/1982 tron clu scene.mp4')
rate=44100
start,duration=10.75,.7
filters='highpass=f=65,lowpass=f=650,equalizer=f=330:t=q:w=4:g=-18'

def fft(values,inverse=False):
    a=list(values);n=len(a);j=0
    for i in range(1,n):
        bit=n>>1
        while j&bit: j^=bit;bit>>=1
        j^=bit
        if i<j:a[i],a[j]=a[j],a[i]
    size=2
    while size<=n:
        root=cmath.exp((2j if inverse else -2j)*math.pi/size)
        for base in range(0,n,size):
            w=1
            for i in range(base,base+size//2):
                u=a[i];v=a[i+size//2]*w
                a[i]=u+v;a[i+size//2]=u-v;w*=root
        size*=2
    return [v/n for v in a] if inverse else a

with tempfile.TemporaryDirectory() as tmp:
    cut=pathlib.Path(tmp)/'engine.wav'
    subprocess.run(['ffmpeg','-v','error','-y','-ss',str(start),'-t',str(duration),'-i',str(source),'-vn','-af',filters,'-ar',str(rate),'-ac','2','-c:a','pcm_s16le',str(cut)],check=True)
    with wave.open(str(cut)) as w: raw=array.array('h',w.readframes(w.getnframes()))
mono=[(raw[i]+raw[i+1])/65536 for i in range(0,len(raw),2)]
window=8192;power=[0.]*(window//2+1);windows=0
for offset in range(0,len(mono)-window+1,window//2):
    spectrum=fft([mono[offset+i]*(.5-.5*math.cos(2*math.pi*i/(window-1))) for i in range(window)])
    for i in range(len(power)):power[i]+=abs(spectrum[i])**2
    windows+=1
power=[p/windows for p in power]
# Each FFT bin completes an integer number of cycles, making the loop boundary
# an ordinary sample transition. Random phases discard the source's knock timing.
length=262144;rng=random.Random(1982);spectrum=[0j]*length
for i in range(1,length//2):
    frequency=i*rate/length
    if frequency<55 or frequency>1000:continue
    position=i*window/length;low=int(position);fraction=position-low
    magnitude=math.sqrt(power[low]*(1-fraction)+power[low+1]*fraction)
    spectrum[i]=cmath.rect(magnitude,rng.random()*2*math.pi)
    spectrum[-i]=spectrum[i].conjugate()
samples=[v.real for v in fft(spectrum,True)]
rms=math.sqrt(sum(v*v for v in samples)/length);gain=.14/rms
# Shared waveform keeps the tank a compact emitter; spatial panning is in-game.
pcm=array.array('h',(round(max(-1,min(1,v*gain))*32767) for v in samples for _ in range(2)))
with wave.open('public/audio/tank-drive.wav','wb') as w:
    w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm.tobytes())
manifest_path=pathlib.Path('public/audio/sources.json');manifest=json.loads(manifest_path.read_text())
for sample in manifest['samples']:
    if sample['name']=='tank-drive':sample.update(source=str(source),source_seek=start,start=start,source_duration=duration,duration=length/rate,filters=filters,loop_crossfade_seconds=0,processing='Spectrum-derived steady engine bed: averaged Hann-window spectrum, deterministic randomized phases, periodic reconstruction; transient timing removed. Rebuild with scripts/smooth-tank-loop.py')
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
steps=[abs(samples[i]-samples[i-1])*gain for i in range(length)]
print(f'Engine bed: {length/rate:.3f}s, RMS {rms*gain:.3f}, peak {max(abs(v) for v in pcm)/32768:.3f}, boundary step {steps[0]:.6f}, maximum step {max(steps):.6f}')
