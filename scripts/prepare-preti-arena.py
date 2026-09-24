"""Extract Daniel Preti's arena walls from OBJ, retaining authored meters/materials.
Streaming conversion skips the two-million-triangle grid and preserves wall geometry.
"""
from pathlib import Path
from array import array
import json, struct, subprocess, argparse
root=Path(__file__).resolve().parents[1]
folder=root/'docs/models/TRON Game Sector+LightCycles-Obj/Obj'
source=folder/'TRON GAME SECTOR + LightCycles.obj'
output=root/'docs/models/preti_light_cycle_arena.glb'
parser=argparse.ArgumentParser()
parser.add_argument('--cycle',choices=['gold','blue','red'])
cycle=parser.parse_args().cycle
cycle_spec={'gold':('Group7',-72.29544830322266,{596,597,601,602}),'blue':('Group8',-73.61005020141602,{595,598,603,604}),'red':('Group13',-74.92074966430664,{599,600,605,606})}
if cycle:output=root/f'docs/models/preti_light_cycle_{cycle}.glb'
materials={};current=None
for line in (folder/'TRON GAME SECTOR + LightCycles.mtl').read_text().splitlines():
 p=line.split()
 if not p:continue
 if p[0]=='newmtl':current=p[1];materials[current]={'name':current,'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':.8},'doubleSided':True}
 elif p[0]=='Kd':materials[current]['pbrMetallicRoughness']['baseColorFactor']=[*map(float,p[1:4]),1]
 elif p[0]=='map_Kd':materials[current]['missingTexture']=' '.join(p[1:])
# Original arena wall bounds, measured independently of surrounding scenery.
center=(cycle_spec[cycle][1],-.0035901700612157583,-1163.5449829101562) if cycle else (-.98,0,-920.865)
v=array('f');normals=array('f');binary=bytearray()
gltf={'asset':{'version':'2.0','generator':'TRON streaming OBJ arena extractor','extras':{'author':'Daniel Preti','source':'User-supplied TRON Game Sector+LightCycles-Obj','license':'Purchased asset; retain seller license. Not CC licensed.','modifications':'Arena walls only; modeled floor removed; vehicles/trails/exterior scenery removed. Centered XZ; Y-up and source meter scale retained.'}},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':[],'buffers':[],'bufferViews':[],'accessors':[]}
matids={};group=None;selected=False;parts={};material=None;total=0

def accessor(data,kind,component,width,bounds=False):
 while len(binary)%4:binary.append(0)
 view=len(gltf['bufferViews']);gltf['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(data)*data.itemsize});binary.extend(data.tobytes())
 a={'bufferView':view,'componentType':component,'count':len(data)//width,'type':kind}
 if bounds:a.update(min=[min(data[i::width]) for i in range(width)],max=[max(data[i::width]) for i in range(width)])
 idx=len(gltf['accessors']);gltf['accessors'].append(a);return idx

def flush():
 global parts,total
 if not parts:return
 primitives=[]
 for name,(positions,ns,indices,lookup) in parts.items():
  if name not in matids:
   m=materials[name]
   if 'missingTexture' in m:
    if not cycle:raise ValueError('Arena needs missing texture: '+m['missingTexture'])
    m=dict(m);m['extras']={'missingTexture':m.pop('missingTexture'),'fallback':'Source diffuse color; texture was not supplied.'}
   matids[name]=len(gltf['materials']);gltf['materials'].append(m)
  attrs={'POSITION':accessor(positions,'VEC3',5126,3,True),'NORMAL':accessor(ns,'VEC3',5126,3)}
  primitives.append({'attributes':attrs,'indices':accessor(indices,'SCALAR',5125,1),'material':matids[name]});total+=len(indices)//3
 mesh=len(gltf['meshes']);gltf['meshes'].append({'name':group,'primitives':primitives});node=len(gltf['nodes']);gltf['nodes'].append({'name':group,'mesh':mesh});gltf['scenes'][0]['nodes'].append(node);parts={}

triangulator=subprocess.Popen(['node',str(root/'scripts/triangulate-obj-face.mjs')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True)
for line in source.open():
 p=line.split()
 if not p:continue
 if p[0]=='v':v.extend(map(float,p[1:4]))
 elif p[0]=='vn':normals.extend(map(float,p[1:4]))
 elif p[0]=='g':
  flush();group=' '.join(p[1:]);selected=(group.endswith(cycle_spec[cycle][0]+' Model') or int(p[1][4:]) in cycle_spec[cycle][2]) if cycle else group.endswith('Group2 Model')
 elif p[0]=='usemtl':material=p[1]
 elif p[0]=='f' and selected:
  face_material=material
  if face_material not in parts:parts[face_material]=(array('f'),array('f'),array('I'),{})
  positions,ns,indices,lookup=parts[face_material];face=[]
  for token in p[1:]:
   fields=token.split('/');vi=int(fields[0]);ni=int(fields[2]);vi=vi-1 if vi>0 else len(v)//3+vi;ni=ni-1 if ni>0 else len(normals)//3+ni
   key=(vi,ni)
   if key not in lookup:
    lookup[key]=len(positions)//3;positions.extend((v[vi*3+i]-center[i])*(-1 if cycle and i!=1 else 1) for i in range(3));ns.extend(normals[ni*3+i]*(-1 if cycle and i!=1 else 1) for i in range(3))
   face.append(lookup[key])
  if len(face)==3:indices.extend(face)
  else:
   # SketchUp exports concave ngons (including bridged holes); triangle fans
   # would fill the notches and grid openings with overlapping triangles.
   normal=ns[face[0]*3:face[0]*3+3];drop=max(range(3),key=lambda a:abs(normal[a]));axes=[a for a in range(3) if a!=drop]
   points=[positions[i*3+a] for i in face for a in axes]
   triangulator.stdin.write(json.dumps(points)+'\n');triangulator.stdin.flush()
   tri=json.loads(triangulator.stdout.readline())
   area=sum(points[2*i]*points[2*((i+1)%len(face))+1]-points[2*((i+1)%len(face))]*points[2*i+1] for i in range(len(face)))
   for i in range(0,len(tri),3):
    a,b,c=tri[i:i+3]
    winding=(points[2*b]-points[2*a])*(points[2*c+1]-points[2*a+1])-(points[2*b+1]-points[2*a+1])*(points[2*c]-points[2*a])
    indices.extend([face[a],face[b],face[c]] if winding*area>=0 else [face[a],face[c],face[b]])
flush()
triangulator.stdin.close();triangulator.wait()
while len(binary)%4:binary.append(0)
if cycle:gltf['asset']['extras']['modifications']='Isolated '+cycle+' light cycle with wheel details; trails removed. Centered, grounded, forward -Z; original scale retained. Missing small decal texture uses source diffuse color.'
gltf['buffers']=[{'byteLength':len(binary)}]
encoded=json.dumps(gltf,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
output.write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(encoded)+8+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary)
print(json.dumps({'output':str(output),'triangles':total,'meshes':len(gltf['meshes']),'bytes':output.stat().st_size,'materials':list(matids)},indent=2))
