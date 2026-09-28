"""Move Preti's four signature/date inscriptions into a separate archival GLB.
Run on the arena converter's GLB output; preserves coordinates and material data.
"""
import copy
import json
import struct
from pathlib import Path

folder = Path(__file__).resolve().parents[1] / 'docs/models'
source = folder / 'preti_light_cycle_arena.glb'
data = source.read_bytes()
length = struct.unpack_from('<I', data, 12)[0]
gltf = json.loads(data[20:20 + length])
binary = data[28 + length:]
signatures = [i for i, n in enumerate(gltf['nodes']) if 'daniel_preti_' in n.get('name', '')]
if not signatures:
    raise SystemExit('Arena already has no signature geometry; no files changed.')
assert len(signatures) == 116, 'Unexpected signature layout; inspect before splitting.'
assert not any(k in gltf for k in ('textures', 'animations', 'skins')), 'Unsupported asset features'

def extract(ids, destination, description):
    result = copy.deepcopy(gltf)
    result.update(nodes=[], meshes=[], accessors=[], bufferViews=[], materials=[])
    blob = bytearray()
    maps = {key: {} for key in ('meshes', 'accessors', 'bufferViews', 'materials')}
    def take(kind, old):
        if old in maps[kind]:
            return maps[kind][old]
        item = copy.deepcopy(gltf[kind][old])
        if kind == 'meshes':
            for p in item['primitives']:
                p['attributes'] = {k: take('accessors', v) for k, v in p['attributes'].items()}
                if 'indices' in p: p['indices'] = take('accessors', p['indices'])
                if 'material' in p: p['material'] = take('materials', p['material'])
        elif kind == 'accessors':
            item['bufferView'] = take('bufferViews', item['bufferView'])
        elif kind == 'bufferViews':
            blob.extend(b'\0' * (-len(blob) % 4))
            start = item.get('byteOffset', 0)
            item['byteOffset'] = len(blob)
            blob.extend(binary[start:start + item['byteLength']])
        new = len(result[kind]); maps[kind][old] = new
        result[kind].append(item)
        return new
    for i in ids:
        node = copy.deepcopy(gltf['nodes'][i])
        assert 'children' not in node
        node['mesh'] = take('meshes', node['mesh'])
        result['nodes'].append(node)
    result['scenes'] = [{'nodes': list(range(len(ids)))}]
    result['scene'] = 0
    result['asset']['extras']['modifications'] += ' ' + description
    result['buffers'] = [{'byteLength': len(blob)}]
    encoded = json.dumps(result, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    blob.extend(b'\0' * (-len(blob) % 4))
    output = (struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(blob))
              + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded
              + struct.pack('<II', len(blob), 0x004e4942) + blob)
    destination.write_bytes(output)
    triangles = sum(result['accessors'][p['indices']]['count'] // 3 for m in result['meshes'] for p in m['primitives'])
    print(destination.name, len(ids), 'meshes', triangles, 'triangles', len(output), 'bytes')

extract(signatures, folder / 'preti_arena_signatures.glb', 'Signature/date inscriptions only, at their original arena coordinates; archived separately and not loaded in game.')
extract([i for i in range(len(gltf['nodes'])) if i not in signatures], source, 'All four signature/date inscriptions moved to preti_arena_signatures.glb; attribution retained in credits.')
