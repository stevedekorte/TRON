import test from 'node:test';
import assert from 'node:assert/strict';
import {CycleLossCue,CYCLE_LOSS_CUE} from '../../src/audio/cycle-loss-cue.js';
const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
function setup(teams=[0,0,0,1,1,1]){
 const oscillators=[],context={currentTime:0,
  createOscillator(){const o={frequency:param(),detune:param(),connect(){},disconnect(){},start(t){this.at=t;},stop(){this.stopped=true;}};oscillators.push(o);return o;},
  createGain(){return {gain:param(),connect(){},disconnect(){}};},
  createBiquadFilter(){return {frequency:param(),connect(){},disconnect(){}};}};
 const race={round:1,phase:'racing',time:10,playerId:0,crashes:[],cycles:teams.map((team,id)=>({id,team,alive:true}))};
 const kill=(id,extra={})=>{race.cycles[id].alive=false;race.crashes.push({id,team:race.cycles[id].team,time:race.time,...extra});};
 return {cue:new CycleLossCue(context,{}),context,oscillators,race,kill};
}
test('a teammate loss and an opponent loss play different cues, wherever they are',()=>{
 const {cue,race,kill,oscillators}=setup();cue.update(race,null,true,true);
 kill(1);assert.deepEqual(cue.update(race,null,true,true),['friendly']);
 const friendly=oscillators.length;kill(4);assert.deepEqual(cue.update(race,null,true,true),['opponent']);
 assert.equal(friendly,CYCLE_LOSS_CUE.friendly.notes.length*2);
 assert.deepEqual(cue.update(race,null,true,true),[],'each loss plays once');
});
test('silent for the rider\'s own crash, stale or silent crashes, observers, mute and solo-off',()=>{
 let {cue,race,kill}=setup();cue.update(race,null,true,true);kill(0);assert.deepEqual(cue.update(race,null,true,true),[],'own crash');
 kill(3,{time:race.time-1});assert.deepEqual(cue.update(race,null,true,true),[],'stale');
 kill(4,{silent:true});assert.deepEqual(cue.update(race,null,true,true),[],'silent');
 ({cue,race,kill}=setup());race.crashes.push({id:5,team:1,time:race.time});race.cycles[5].alive=false;
 assert.deepEqual(cue.update(race,null,true,true),[],'already dead on arrival');
 kill(4);assert.deepEqual(cue.update(race,null,false,true),[],'muted');
 kill(3);assert.deepEqual(cue.update(race,null,true,false),[],'not in cycle mode');
});
test('keeps playing after the rider dies; multiplayer team follows the seat',()=>{
 let {cue,race,kill}=setup();cue.update(race,null,true,true);kill(0);cue.update(race,null,true,true);
 kill(2);assert.deepEqual(cue.update(race,null,true,true),['friendly'],'teammate lost while spectating');
 ({cue,race,kill}=setup());const mp={connected:true,seat:4};cue.update(race,mp,true);
 kill(1);assert.deepEqual(cue.update(race,mp,true),['opponent']);kill(5);assert.deepEqual(cue.update(race,mp,true),['friendly']);
 mp.seat=null;kill(2);assert.deepEqual(cue.update(race,mp,true),[],'observer');
});
test('simultaneous losses play in sequence, with a cap, and a new round resets',()=>{
 const {cue,race,kill,oscillators}=setup([0,1,1,1,1,1,1,1]);cue.update(race,null,true,true);
 for(let id=1;id<8;id++)kill(id);
 assert.equal(cue.update(race,null,true,true).length,CYCLE_LOSS_CUE.maxQueued+1);
 const starts=[...new Set(oscillators.map(o=>o.at))].sort((a,b)=>a-b);assert(starts[2]-starts[0]>=CYCLE_LOSS_CUE.spacingSeconds-1e-9);
 race.round++;race.crashes=[];for(const b of race.cycles)b.alive=true;cue.update(race,null,true,true);
 assert(oscillators.every(o=>o.stopped));kill(1);assert.deepEqual(cue.update(race,null,true,true),['opponent']);
});
test('a fresh race copy each frame still plays each loss once; a new race resets',()=>{
 const {cue,race,kill}=setup();const copy=()=>({...race,crashes:[...race.crashes],cycles:race.cycles.map(b=>({...b}))});
 cue.update(copy(),null,true,true);kill(4);assert.deepEqual(cue.update(copy(),null,true,true),['opponent']);
 assert.deepEqual(cue.update(copy(),null,true,true),[]);
 race.crashes=[];for(const b of race.cycles)b.alive=true;cue.update(copy(),null,true,true);
 kill(4);assert.deepEqual(cue.update(copy(),null,true,true),['opponent'],'same id, same round number, new race');
});
