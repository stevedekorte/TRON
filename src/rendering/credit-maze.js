import * as T from 'three';
import {WALLS,WALL_HEIGHT} from '../levels/labyrinth-maze.js';

// A disposable miniature of the actual central labyrinth, without the game
// world's unbounded floor, simulation, shadows or other maze sites.
export function createCreditMaze(){
 const root=new T.Group();root.name='Central blueprint labyrinth';
 const positions=[],colors=[];
 const vertex=(p,y,color)=>{positions.push(p.x,y,-p.s);colors.push(...color);};
 const roof=[.035,.075,.19],side=[.012,.022,.047];
 for(const wall of WALLS){
  for(const triangle of wall.triangles)for(const edge of triangle)vertex(edge.a,WALL_HEIGHT,roof);
  for(const {a,b} of wall.edges){
   for(const [p,y] of [[a,0],[b,0],[b,WALL_HEIGHT],[a,0],[b,WALL_HEIGHT],[a,WALL_HEIGHT]])vertex(p,y,side);
  }
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
 const walls=new T.Mesh(geometry,new T.MeshPhongMaterial({vertexColors:true,side:T.DoubleSide,shininess:15}));
 root.add(walls);
 root.add(new T.LineSegments(new T.EdgesGeometry(geometry,30),new T.LineBasicMaterial({color:0x294967,transparent:true,opacity:.55})));
 return root;
}
