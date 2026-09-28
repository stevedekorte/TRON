#!/usr/bin/env python3
"""Extract the user-supplied arena entrance mix; dialogue uses the 5.1 center."""
import array, hashlib, json, pathlib, subprocess, tempfile, wave
source=pathlib.Path('docs/references/videos/Enter Cycle Arena.m4v')
output=pathlib.Path('public/audio')
clips=[('prepare-transport',11.72,14.28,True),('have-transport',17.32,18.65,True),
       ('transport',14.28,17.32,False),('entry-startup',28.35,31.408,False)]
manifest={'source':str(source),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
'attribution':'TRON (1982), Walt Disney Productions; user-supplied reference.',
'useConstraints':'Film soundtrack excerpts; no redistribution license supplied.',
'note':'Dialogue timings located with local transcription. Effects selected against picture; mixed soundtrack, not isolated stems. Listening approval pending.', 'clips':[]}
for name,start,end,dialogue in clips:
    filters=('pan=mono|c0=FC,' if dialogue else '')+'highpass=f=60,afade=t=in:d=0.012,afade=t=out:st='+str(end-start-.035)+':d=0.035'
    with tempfile.TemporaryDirectory() as tmp:
        path=pathlib.Path(tmp)/'clip.wav'
        subprocess.run(['ffmpeg','-v','error','-y','-ss',str(start),'-i',str(source),'-t',str(end-start),'-vn','-af',filters,'-ac','2','-ar','44100','-c:a','pcm_s16le',str(path)],check=True)
        with wave.open(str(path)) as f: pcm=array.array('h',f.readframes(f.getnframes()))
    gain=.72*32767/max(1,max(abs(x) for x in pcm))
    pcm=array.array('h',(round(x*gain) for x in pcm))
    filename='cycle-'+name+'.wav'
    with wave.open(str(output/filename),'wb') as f:
        f.setnchannels(2);f.setsampwidth(2);f.setframerate(44100);f.writeframes(pcm.tobytes())
    manifest['clips'].append({'file':filename,'startSeconds':start,'endSeconds':end,'channelSelection':'center duplicated to stereo' if dialogue else '5.1 stereo downmix','filters':filters,'peakTarget':.72})
(output/'cycle-entry-source.json').write_text(json.dumps(manifest,indent=2)+'\n')
