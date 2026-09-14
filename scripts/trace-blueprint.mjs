import {writeFile} from 'node:fs/promises';
import {OUTLINES,BLUEPRINT_SIZE} from '../src/levels/blueprint-outlines.js';
const [width,height]=BLUEPRINT_SIZE;
const shapes=OUTLINES.map((points,id)=>`<polygon points="${points.map(p=>p.join(',')).join(' ')}"><title>Wall ${id+1}</title></polygon>`).join('\n');
await writeFile('docs/references/maze-trace.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><image href="images/Maze%20Blue%20Print.png" width="${width}" height="${height}"/><g fill="#ffe588" fill-opacity=".07" stroke="#ffe588" stroke-width="2" stroke-linejoin="round">${shapes}</g></svg>`);
console.log('Generated blueprint trace overlay (20 islands).');
