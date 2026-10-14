import {CycleRoom,wireState} from '../shared/multiplayer/room.js';
import {projectState,compactSnapshot} from '../shared/multiplayer/snapshots.js';
import {MP} from '../shared/multiplayer/config.js';
for(const humans of [1,12]){
 const room=new CycleRoom();for(let i=0;i<humans;i++)room.join('measure-'+i);
 room.race.remaining=0;room.step();let previous,compactPrevious,bytes=0,compactBytes=0,count=0;
 const seconds=5;
 for(let i=0;i<MP.tickHz*seconds;i++){
  room.step();if(room.tick%MP.snapshotTicks)continue;
  const state=room.state(),compact=projectState(state);
  bytes+=Buffer.byteLength(JSON.stringify(wireState(state,previous)));
  compactBytes+=Buffer.byteLength(JSON.stringify(compactSnapshot(compact,compactPrevious)));
  previous=state;compactPrevious=compact;count++;
 }
 console.log(JSON.stringify({humans,cycles:room.race.cycles.length,snapshots:count,seconds,
  previousBytesPerSecond:Math.round(bytes/seconds),compactBytesPerSecond:Math.round(compactBytes/seconds),
  reductionPercent:Math.round((1-compactBytes/bytes)*1000)/10}));
}
