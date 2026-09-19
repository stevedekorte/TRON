"""Rebuild transfer cues from the user's mixed Sark/MCP film soundtrack."""
import json, subprocess
from pathlib import Path
source = 'docs/references/videos/Sark and MCP.mp4'
out = Path('public/audio')
# Film frames show the surrounding shafts forming during this interval.
start, duration = 52.75, 1.5
cleanup = 'highpass=f=180,lowpass=f=7200,afftdn=nf=-28:tn=1'
for name, reverse in [('data-ring-close', False), ('data-ring-open', True)]:
    filters = cleanup + (',areverse' if reverse else '')
    filters += ',atempo=0.5,afade=t=in:d=0.035,afade=t=out:st=2.55:d=0.45,loudnorm=I=-23:TP=-3:LRA=7'
    subprocess.run(['ffmpeg','-y','-ss',str(start),'-t',str(duration),'-i',source,'-vn','-af',filters,'-ar','44100','-ac','2','-c:a','pcm_s16le',str(out/(name+'.wav')),'-loglevel','error'],check=True)
(out/'data-ring-source.json').write_text(json.dumps({'source':source,'start':start,'duration':duration,'origin':'User-supplied TRON (1982) mixed soundtrack; not an isolated production stem','processing':cleanup,'close':'Pitch-preserving 2x stretch with soft attack and release','open':'Reversed close source, same stretch and fades; designed adaptation, not a separate original film effect','rebuild':'python3 scripts/extract-transfer-sfx.py'},indent=2)+'\n')
