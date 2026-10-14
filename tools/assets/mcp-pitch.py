import numpy as np
from scipy import signal
from scipy.io import wavfile

def pitch(path):
 sr,x=wavfile.read(path);x=x.astype(float)/32768
 if x.ndim>1:x=x.mean(axis=1)
 x=signal.resample_poly(x,1,sr//8000);sr=8000
 x=signal.sosfilt(signal.butter(3,[45,1200],btype='bandpass',fs=sr,output='sos'),x)
 values=[]
 for i in range(0,len(x)-640,80):
  f=x[i:i+640];f-=f.mean()
  if np.sqrt(np.mean(f*f))<.018:continue
  d=np.array([np.sum((f[:480]-f[t:t+480])**2) for t in range(1,161)])
  cm=d*np.arange(1,161)/np.maximum(np.cumsum(d),1e-12)
  minima=signal.find_peaks(-cm)[0];candidates=[k for k in minima if k>=31 and cm[k]<.18]
  if not candidates:continue
  k=candidates[0];t=k+1
  if 0<k<len(cm)-1:t+=.5*(cm[k-1]-cm[k+1])/(cm[k-1]-2*cm[k]+cm[k+1])
  values.append(sr/t)
 return {'medianHz':float(np.median(values)),'q25Hz':float(np.percentile(values,25)),'q75Hz':float(np.percentile(values,75)),'voicedFrames':len(values)}
if __name__=='__main__':
 import sys,json
 for p in sys.argv[1:]:print(p,json.dumps(pitch(p)))
