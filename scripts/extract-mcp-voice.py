#!/usr/bin/env python3
"""Reproduce the MCP-only reference from the user's 5.1 film clip."""
import array, hashlib, json, pathlib, subprocess, tempfile, wave
source=pathlib.Path('docs/references/videos/MCP/MCPandSARK.m4v')
output=pathlib.Path('public/audio/mcp-reference.wav')
start,end=23.23,31.08
filters=f'pan=mono|c0=FC,highpass=f=30,afade=t=in:d=0.015,afade=t=out:st={end-start-.035}:d=0.035'
with tempfile.TemporaryDirectory() as tmp:
    path=pathlib.Path(tmp)/'reference.wav'
    subprocess.run(['ffmpeg','-v','error','-y','-ss',str(start),'-i',str(source),'-t',str(end-start),'-vn','-af',filters,'-ar','24000','-c:a','pcm_s16le',str(path)],check=True)
    with wave.open(str(path)) as f: pcm=array.array('h',f.readframes(f.getnframes()))
gain=.89*32767/max(1,max(abs(x) for x in pcm))
pcm=array.array('h',(round(x*gain) for x in pcm))
with wave.open(str(output),'wb') as f:
    f.setnchannels(1);f.setsampwidth(2);f.setframerate(24000);f.writeframes(pcm.tobytes())
manifest={'source':str(source),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'startSeconds':start,'endSeconds':end,'speaker':'MCP','transcript':"That's right. He pushed me in the real world. Somebody pushes me, I push back. So I brought him down here.",'channel':'5.1 front center','filters':filters,'sampleRateHz':24000,'peakTarget':.89,'attribution':'TRON (1982), Walt Disney Productions. User-supplied film excerpt; no redistribution license supplied.','note':'Reference conditioning audio, not a trained model. No Sark speech selected. Speaker boundaries identified using local Whisper transcription and scene reference.'}
output.with_suffix('.json').write_text(json.dumps(manifest,indent=2)+'\n')
