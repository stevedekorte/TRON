#!/usr/bin/env python3
"""Reproducible film-mix extracts; candidates, not isolated effects stems."""
import array, hashlib, json, math, pathlib, subprocess, tempfile, wave
source = pathlib.Path('docs/references/videos/TRON light cycles.mp4')
output = pathlib.Path('public/audio')
rate = 44100
cabin_rms_target = .118  # Matches the previous cabin loop's integrated level.
# Timing selected against the supplied picture. Keep clips short to limit bleed.
clips = [('materialize', 26.7, .7), ('startup', 28.8, 1.0), ('launch', 30.0, 1.25),
         ('drive', 47.0, 1.0), ('drive-cabin', 96.7, 1.1), ('turn', 51.0, 1.0),
         ('explosion', 75.85, 2.0), ('wall-down', 78.8, .7)]
manifest = {'source': str(source), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'attribution': 'TRON (1982), Walt Disney Productions; supplied reference soundtrack.',
            'useConstraints': 'Film-derived mixed soundtrack; no redistribution license supplied.',
            'note': 'Picture-selected candidates, not isolated stems. Cabin pitch variation remains unresolved.',
            'sampleRate': rate, 'channels': 2, 'clips': []}
for name, start, duration in clips:
    filters = 'highpass=f=100,lowpass=f=8500'
    with tempfile.TemporaryDirectory() as tmp:
        path = pathlib.Path(tmp) / 'clip.wav'
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(start),
                        '-i', str(source), '-t', str(duration), '-vn', '-af', filters,
                        '-ar', str(rate), '-ac', '2', '-c:a', 'pcm_s16le', str(path)], check=True)
        with wave.open(str(path)) as audio:
            pcm = array.array('h', audio.readframes(audio.getnframes()))
    samples = [[pcm[i]/32768, pcm[i+1]/32768] for i in range(0,len(pcm),2)]
    if name in ('drive', 'drive-cabin'):
        n = int((.2 if name == 'drive-cabin' else .1)*rate)
        loop = [f[:] for f in samples[n:]]
        for i in range(n):
            weight = .5-.5*math.cos(math.pi*i/(n-1))
            a, b = (math.sqrt(1-weight), math.sqrt(weight)) if name == 'drive-cabin' else (1-weight, weight)
            loop[-n+i] = [loop[-n+i][c]*a+samples[i][c]*b for c in range(2)]
        samples = loop
        if name == 'drive-cabin':
            # Restore the film waveform, with only stereo-linked level smoothing.
            half = round(.05*rate)
            energy = [sum(v*v for v in frame)/2 for frame in samples]
            target = sum(energy)/len(energy)
            power = sum(energy[i % len(energy)] for i in range(-half, half+1))
            gains = []
            for i in range(len(samples)):
                gains.append(math.sqrt(target/max(1e-12,power/(2*half+1))))
                power += energy[(i+half+1)%len(energy)]-energy[(i-half)%len(energy)]
            samples = [[v*gains[i] for v in frame] for i,frame in enumerate(samples)]
    else:
        n = int(.012*rate)
        for i in range(n):
            for c in range(2):
                samples[i][c] *= i/(n-1)
                samples[-1-i][c] *= i/(n-1)
    peak = max(abs(v) for frame in samples for v in frame)
    gain = .7/max(.001,peak)
    if name == 'drive-cabin':
        rms = math.sqrt(sum(v*v for frame in samples for v in frame)/(2*len(samples)))
        gain = min(gain,cabin_rms_target/max(.001,rms))
    pcm = array.array('h',(round(v*gain*32767) for frame in samples for v in frame))
    filename = 'cycle-'+name+'.wav'
    with wave.open(str(output/filename),'wb') as audio:
        audio.setnchannels(2); audio.setsampwidth(2); audio.setframerate(rate); audio.writeframes(pcm.tobytes())
    manifest['clips'].append({'file': filename, 'startSeconds': start, 'endSeconds': start+duration,
                              'filters': filters, 'peakTarget': .7,
                              'loopCrossfadeSeconds': .2 if name == 'drive-cabin' else .1 if name == 'drive' else 0})
    if name == 'drive-cabin':
        manifest['clips'][-1].update(rmsTarget=cabin_rms_target, loopCrossfadeCurve='equal-power raised-cosine',
            leveling='100 ms circular stereo-linked RMS',
            selection='Film waveform restored after synthesized drone was rejected; pitch variation unresolved.')
(output/'cycle-source.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Extracted eight cycle sound candidates.')
