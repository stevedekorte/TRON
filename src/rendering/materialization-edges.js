import {EdgesGeometry} from 'three';
// Vehicle instances share immutable mesh geometry. Trace its edges once, then
// clone the small result so each scene can dispose its own GPU resources safely.
const cache=new WeakMap();
export function materializationEdges(source){
 const position=source.getAttribute('position'),index=source.index;
 let entry=cache.get(source);
 if(!entry||entry.position!==position||entry.positionVersion!==position.version||entry.index!==index||entry.indexVersion!==index?.version){
  entry?.edges.dispose();
  entry={position,positionVersion:position.version,index,indexVersion:index?.version,edges:new EdgesGeometry(source,25)};
  cache.set(source,entry);
 }
 return entry.edges.clone();
}
