#!/usr/bin/env python3
"""Candidate cleanup of the supplied mixed explosion. Requires numpy/scipy.
Tonal/percussive spectral separation cannot fully remove overlapping SFX.
"""
import subprocess, pathlib, json, hashlib
import numpy as np
from scipy import signal, ndimage
from scipy.io import wavfile
source=pathlib.Path('docs/references/sounds/Recognizer Explosion.m4a')
video=pathlib.Path('docs/references/videos/1982 tron clu scene.mp4')
out=pathlib.Path('public/audio/studies');out.mkdir(parents=True,exist_ok=True)
rate=44100

def decode(path,start=None,duration=None):
 cmd=['ffmpeg','-v','error']
 if start is not None:cmd+=['-ss',str(start),'-t',str(duration)]
 cmd+=['-i',str(path),'-vn','-ar',str(rate),'-ac','2','-f','f32le','-']
 return np.frombuffer(subprocess.check_output(cmd),dtype=np.float32).reshape(-1,2).astype(np.float64)

clip=decode(source)
# Verified by normalized waveform correlation: supplied edit starts at 113.207s.
context_start=112.55
context=decode(video,context_start,1.7)
f,t,z=signal.stft(context.T,fs=rate,nperseg=2048,noverlap=1920)
mag=np.sqrt(np.mean(abs(z)**2,axis=0))
# Sustained frequency ridges favor horns and tonal cannon components; broad
# short-lived energy favors the explosion. A shared mask retains stereo phase.
harmonic=ndimage.median_filter(mag,size=(1,75))
percussive=ndimage.median_filter(mag,size=(17,1))
start=round((113.207-context_start)*rate)
base_gain=.72/max(np.max(abs(clip)),1e-8)
metadata={'source':str(source),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'matched_video_time':113.207,'correlation':.997,'method':'Shared stereo harmonic/percussive soft mask; two suppression strengths; no isolated production stems','variants':[]}

def save(name,data):
 data=data.copy();fade=min(round(.012*rate),len(data)//2)
 data[:fade]*=np.linspace(0,1,fade)[:,None];data[-fade:]*=np.linspace(1,0,fade)[:,None]
 data*=base_gain
 assert np.isfinite(data).all() and np.max(abs(data))<1
 wavfile.write(out/(name+'.wav'),rate,(data*32767).astype(np.int16))
 return float(np.sqrt(np.mean(data**2)))

save('recognizer-explosion-original',clip)
for name,strength,floor in [('balanced',1.6,.18),('strong',3.,.055)]:
 mask=percussive**2/(percussive**2+(harmonic*strength)**2+1e-15)
 mask=ndimage.gaussian_filter(np.maximum(mask,floor),sigma=(.7,.7))
 _,clean=signal.istft(z*mask[None,:,:],fs=rate,nperseg=2048,noverlap=1920)
 clean=clean.T[start:start+len(clip)]
 clean=signal.sosfilt(signal.butter(2,[65,8500],btype='bandpass',fs=rate,output='sos'),clean,axis=0)
 rms=save('recognizer-explosion-'+name,clean)
 metadata['variants'].append({'name':name,'duration':len(clean)/rate,'rms':rms,'mask_floor':floor,'harmonic_strength':strength})
(out/'recognizer-explosion-cleanup.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(json.dumps(metadata,indent=2))
