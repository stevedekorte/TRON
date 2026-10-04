import {MeshPhongMaterial} from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';

// Reuse ControllingTransmission's original neutral BIT model and lavender color.
export async function createCreditBit(){
 const root=await new OBJLoader().loadAsync(`${import.meta.env.BASE_URL}bit/resources/entities/Bit/models/bit_idle_1.obj`);
 const material=new MeshPhongMaterial({color:'rgb(200, 200, 255)',flatShading:true,shininess:50});
 const original=new Set();
 root.traverse(o=>{if(o.isMesh){for(const m of Array.isArray(o.material)?o.material:[o.material])original.add(m);o.material=material;}});
 original.forEach(m=>m.dispose());
 root.name='BIT by ControllingTransmission';
 return root;
}
