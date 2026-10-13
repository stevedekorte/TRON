import {Group} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import modelUrl from '../../docs/models/preti_light_cycle_arena.glb?url';
import {createArenaFloor} from './arena-floor.js';
import {styleArena} from './arena-style.js';

// Architecture only: no race, AI, gameplay listeners or persistent damage.
export async function createCreditArena(){
 const {scene}=await new GLTFLoader().loadAsync(modelUrl);
 const originals=new Set();
 scene.traverse(o=>{if(o.material)[].concat(o.material).forEach(m=>originals.add(m));});
 styleArena(scene,{wallTopMinHeightMeters:49*2/932});
 originals.forEach(m=>m.dispose());
 const root=new Group();root.name='Credit cycle arena';
 root.add(scene,createArenaFloor({elevationMeters:.02}));
 return root;
}
