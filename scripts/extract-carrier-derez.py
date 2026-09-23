#!/usr/bin/env python3
"""Extract an audition clip and loop candidate from the supplied mixed soundtrack."""
import array
import hashlib
import json
import math
import pathlib
import subprocess
import tempfile
import wave

source = pathlib.Path('docs/references/videos/Carrier derezed.mp4')
output = pathlib.Path('public/audio')
start, duration, rate, crossfade = 158.5, 1.5, 44100, 0.12
filters = 'highpass=f=70,lowpass=f=9000'
with tempfile.TemporaryDirectory() as directory:
    path = pathlib.Path(directory) / 'clip.wav'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(start),
                    '-i', str(source), '-t', str(duration), '-vn', '-af', filters,
                    '-ar', str(rate), '-ac', '2', '-c:a', 'pcm_s16le', str(path)], check=True)
    with wave.open(str(path)) as audio:
        raw = array.array('h', audio.readframes(audio.getnframes()))
frames = [[raw[i] / 32768, raw[i + 1] / 32768] for i in range(0, len(raw), 2)]
peak = max(abs(value) for frame in frames for value in frame)
gain = 0.7 / max(peak, 0.001)

def write(name, samples):
    pcm = array.array('h', (round(max(-1, min(1, value * gain)) * 32767)
                           for frame in samples for value in frame))
    with wave.open(str(output / name), 'wb') as audio:
        audio.setnchannels(2)
        audio.setsampwidth(2)
        audio.setframerate(rate)
        audio.writeframes(pcm.tobytes())

# Keep the film's direction/envelope, with tiny edge fades to avoid clicks.
clip = [frame[:] for frame in frames]
fade = int(0.025 * rate)
for i in range(fade):
    weight = i / (fade - 1)
    clip[i] = [v * weight for v in clip[i]]
    clip[-1 - i] = [v * weight for v in clip[-1 - i]]
write('carrier-derez.wav', clip)
n = int(crossfade * rate)
loop = [frame[:] for frame in frames[n:]]
for i in range(n):
    weight = 0.5 - 0.5 * math.cos(math.pi * i / (n - 1))
    loop[-n + i] = [loop[-n + i][c] * (1 - weight) + frames[i][c] * weight for c in range(2)]
write('carrier-derez-loop.wav', loop)
(output / 'carrier-derez-source.json').write_text(json.dumps({
    'source': str(source), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'startSeconds': start, 'endSeconds': start + duration, 'filters': filters,
    'peakTarget': 0.7, 'edgeFadeSeconds': 0.025, 'loopCrossfadeSeconds': crossfade,
    'sampleRate': rate, 'channels': 2,
    'note': 'Mixed film soundtrack, not an isolated sound-effects stem. Audition candidates; not loaded by gameplay.'
}, indent=2) + '\n')
print(f'Extracted {len(clip)/rate:.2f}s clip and {len(loop)/rate:.2f}s loop candidate.')
