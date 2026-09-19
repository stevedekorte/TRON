import json,struct,collections
from pathlib import Path
b=Path('docs/models/extra/tron_1982.glb').read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);data=b[28+n:]
def read(i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];cnt={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']];fmt={5126:'f',5125:'I',5123:'H'}[a['componentType']];size=struct.calcsize(fmt)*cnt;off=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from('<'+fmt*cnt,data,off+k*v.get('byteStride',size)) for k in range(a['count'])]
mesh_index=next(i for i,m in enumerate(j['meshes']) if any(j['materials'][p.get('material',0)].get('name')=='Clouds' for p in m['primitives']))
p=next(p for p in j['meshes'][mesh_index]['primitives'] if j['materials'][p.get('material',0)].get('name')=='Clouds');positions=read(p['attributes']['POSITION']);indices=[i[0] for i in read(p['indices'])];parents=list(range(len(positions)))
def find(x):
 while parents[x]!=x: parents[x]=parents[parents[x]];x=parents[x]
 return x
def union(a,b):parents[find(a)]=find(b)
weld={}
for i,pos in enumerate(positions):
 key=tuple(round(v,2) for v in pos)
 if key in weld:union(i,weld[key])
 else:weld[key]=i
for a,b,c in zip(indices[::3],indices[1::3],indices[2::3]):union(a,b);union(a,c)
groups=collections.defaultdict(list)
for i in range(len(positions)):groups[find(i)].append(i)
groups=sorted(groups.values(),key=len,reverse=True)
# All four source components are complete copies; extract the first largest one.
selected=groups[0];lookup={old:new for new,old in enumerate(selected)}
triangles=[lookup[i] for i in indices if i in lookup]
assert len(triangles)%3==0
# Bake the source hierarchy (including its Z-up -> Y-up conversion).
identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
def multiply(a,b):return [sum(a[k*4+r]*b[c*4+k] for k in range(4)) for c in range(4) for r in range(4)]
node_index=next(i for i,node in enumerate(j['nodes']) if node.get('mesh')==mesh_index)
chain=[]
while True:
 chain.append(node_index)
 parent=next((i for i,node in enumerate(j['nodes']) if node_index in node.get('children',[])),None)
 if parent is None:break
 node_index=parent
matrix=identity
for i in reversed(chain):
 node=j['nodes'][i]
 assert not any(k in node for k in ('translation','rotation','scale')), 'Unexpected TRS source node'
 matrix=multiply(matrix,node.get('matrix',identity))
def transform(v,w):return tuple(sum(matrix[k*4+r]*v[k] for k in range(3))+matrix[12+r]*w for r in range(3))
points=[transform(positions[i],1) for i in selected]
center=[(min(p[a] for p in points)+max(p[a] for p in points))/2 for a in range(3)]
points=[tuple(p[a]-center[a] for a in range(3)) for p in points]
normals=[]
source_normals=read(p['attributes']['NORMAL'])
for i in selected:
 n=transform(source_normals[i],0);length=sum(v*v for v in n)**.5;normals.append(tuple(v/length for v in n))
chunks=[];views=[];accessors=[]
def accessor(values,fmt,component,kind,target,bounds=False):
 offset=sum(len(c) for c in chunks);chunk=struct.pack('<'+fmt*sum(len(v) for v in values),*(x for v in values for x in v));length=len(chunk);chunk+=b'\0'*((-length)%4);chunks.append(chunk)
 views.append({'buffer':0,'byteOffset':offset,'byteLength':length,'target':target})
 a={'bufferView':len(views)-1,'componentType':component,'count':len(values),'type':kind}
 if bounds:a.update(min=[min(v[k] for v in values) for k in range(len(values[0]))],max=[max(v[k] for v in values) for k in range(len(values[0]))])
 accessors.append(a);return len(accessors)-1
pos=accessor(points,'f',5126,'VEC3',34962,True);normal=accessor(normals,'f',5126,'VEC3',34962);idx=accessor([(i,) for i in triangles],'H',5123,'SCALAR',34963)
binary=b''.join(chunks)
asset={'version':'2.0','generator':'TRON cloud component extractor','extras':{**j['asset'].get('extras',{}),'modification':'One connected grid cloud extracted; source transforms baked, centered at origin, original material retained.'}}
model={'asset':asset,'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'Grid Cloud','mesh':0}],'meshes':[{'name':'Grid Cloud','primitives':[{'attributes':{'POSITION':pos,'NORMAL':normal},'indices':idx,'material':0}]}],'materials':[j['materials'][p['material']]],'accessors':accessors,'bufferViews':views,'buffers':[{'byteLength':len(binary)}]}
encoded=json.dumps(model,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
out=Path('docs/models/cloud.glb');out.write_bytes(struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary)
print(json.dumps({'output':str(out),'sourceClouds':len(groups),'vertices':len(points),'triangles':len(triangles)//3,'size':[max(p[a] for p in points)-min(p[a] for p in points) for a in range(3)],'bytes':out.stat().st_size},indent=2))
