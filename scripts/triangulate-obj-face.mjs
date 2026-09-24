// Line-based helper for the streaming Python converter's concave OBJ faces.
import {createInterface} from 'node:readline';
import {Earcut} from '../node_modules/three/src/extras/Earcut.js';
for await(const line of createInterface({input:process.stdin}))console.log(JSON.stringify(Earcut.triangulate(JSON.parse(line))));
