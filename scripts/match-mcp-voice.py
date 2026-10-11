#!/usr/bin/env python3
"""Render reproducible MCP film/clone comparisons (requires NumPy, SciPy, FFmpeg).
Generate dry.wav and the word-timed Whisper transcripts in test-results/mcp-voice-match first.
Pitch and pause-energy measurements are guides, not perceptual similarity scores.
"""
import importlib.util,json,pathlib,subprocess
import numpy as np
from scipy import signal
from scipy.io import wavfile
spec=importlib.util.spec_from_file_location('pitch','scripts/mcp-pitch.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
work=pathlib.Path('test-results/mcp-voice-match');out=pathlib.Path('public/audio/mcp-match');out.mkdir(parents=True,exist_ok=True)
original=pathlib.Path('public/audio/mcp-reference.wav');dry=work/'dry.wav'
sr=24000

def read(path):
 rate,x=wavfile.read(path);assert rate==sr
 return x.astype(np.float64)/32768

def save(path,x):
 wavfile.write(path,sr,np.round(np.clip(x,-.999,.999)*32767).astype(np.int16))

def ffmpeg(source,target,filters):
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-af',filters,'-ar',str(sr),'-c:a','pcm_s16le',str(target)],check=True)

def tail_ratio(x,words):
 # Same two phrase endings, with enough silence in both performances.
 ratios=[]
 for w in words:
  if w['word'].strip().strip('.,').lower() not in ('right','world'):continue
  end=w['end'];a=x[int((end-.18)*sr):int(end*sr)];b=x[int((end+.04)*sr):int((end+.22)*sr)]
  ratios.append(10*np.log10((np.mean(b*b)+1e-9)/(np.mean(a*a)+1e-9)))
 return float(np.median(ratios))

def reverb(x,wet,decay):
 # Deterministic diffuse tail plus early reflections, no added film audio.
 n=int(sr*decay);t=np.arange(n)/sr;rng=np.random.default_rng(1982)
 ir=signal.sosfilt(signal.butter(2,2600,fs=sr,output='sos'),rng.normal(size=n))
 ir*=np.exp(-6.9078*t/decay);ir[:int(.024*sr)]=0
 ir/=max(np.linalg.norm(ir),1e-9)
 ir*=.24
 for delay,level in [(31,.18),(47,.16),(71,.13),(109,.10),(163,.07),(241,.045),(353,.025)]:
  if int(delay*sr/1000)<n:ir[int(delay*sr/1000)]+=level
 return np.pad(x,(0,n-1))+wet*signal.fftconvolve(x,ir)

op=mod.pitch(original);dp=mod.pitch(dry);ratio=op['medianHz']/dp['medianHz']
ffmpeg(dry,work/'pitch.wav',f'rubberband=pitch={ratio}:formant=preserved:pitchq=quality')
# Measure again and correct residual pitch-shifter/estimator discrepancy once.
measured=mod.pitch(work/'pitch.wav');correction=op['medianHz']/measured['medianHz']
if abs(12*np.log2(correction))>.15:
 ratio*=correction;ffmpeg(dry,work/'pitch.wav',f'rubberband=pitch={ratio}:formant=preserved:pitchq=quality')
ow=json.loads((work/'original-transcript.json').read_text());dw=json.loads((work/'dry-transcript.json').read_text())
words=lambda d:[w for seg in d['segments'] for w in seg['words']]
target_tail=tail_ratio(read(original),words(ow));x=read(work/'pitch.wav');trials=[]
for decay in [.3,.45,.65,.9]:
 for wet in [.15,.3,.45,.6,.8,1,1.25]:
  y=reverb(x,wet,decay);value=tail_ratio(y,words(dw));trials.append({'wet':wet,'decaySeconds':decay,'pauseRatioDb':value,'differenceDb':abs(value-target_tail)})
best=min(trials,key=lambda a:a['differenceDb']);save(work/'matched.wav',reverb(x,best['wet'],best['decaySeconds']))
# Keep the already-liked lower pitch as an alternative, with the same room effect.
ffmpeg(dry,work/'deeper.wav','asetrate=22080,aresample=24000,atempo=1.0869565')
save(work/'deeper-room.wav',reverb(read(work/'deeper.wav'),best['wet'],best['decaySeconds']))
for name,source in [('original',original),('dry',dry),('matched',work/'matched.wav'),('deeper',work/'deeper-room.wav')]:
 ffmpeg(source,out/(name+'.wav'),'loudnorm=I=-20:TP=-2:LRA=11')
report={'text':json.loads(pathlib.Path('public/audio/mcp-reference.json').read_text())['transcript'],'source':'../mcp-reference.json','generation':json.loads((work/'generation.json').read_text()),'originalPitch':op,'dryPitch':dp,'pitchRatio':ratio,'matchedPitch':mod.pitch(out/'matched.wav'),'originalPauseRatioDb':target_tail,'selectedReverb':best,'trials':trials,'originalTranscript':ow['text'],'cloneTranscript':dw['text'],'limitations':'Pitch estimator and two pause measurements are approximate; residual soundtrack, differing inflection and word timing affect them. No perceptual listening score is claimed. Whisper reads push back as pushed back in the clone. Original performance and prior approved sample are preserved.'}
(out/'comparison.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['originalPitch','dryPitch','matchedPitch','selectedReverb']},indent=2))
