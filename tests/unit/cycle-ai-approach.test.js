import test from 'node:test';
import assert from 'node:assert/strict';
import {ApproachGraph,ApproachRewards} from '../../tools/ai/approach.mjs';
import {matchFitness} from '../../tools/ai/fitness.mjs';
import {match} from '../../tools/ai/benchmark.mjs';
const wall=(x,z1,z2)=>({a:{x,z:z1},end:{x,z:z2}});
const distance=(barriers,from,to,options={})=>{
 const graph=new ApproachGraph(barriers,{step:.5,edge:6,radius:.1,...options});
 return graph.distance(graph.field(to),graph.connectors(from));
};
test('approach routes detour around walls and never cross thin between-node barriers',()=>{
 const from={x:-2,z:0},to={x:2,z:0};
 assert.equal(distance([],from,to),19.2);
 assert(distance([wall(.25,-3,3)],from,to)>40);
 assert.equal(distance([wall(.25,-6,6)],from,to),Infinity);
 assert.equal(distance([],from,{x:7,z:0}),Infinity);
});
test('route graph retains a traversable doorway and blocks insufficient disc clearance',()=>{
 const from={x:-2,z:0},to={x:2,z:0};
 assert(Number.isFinite(distance([wall(.25,-6,1.5),wall(.25,2.5,6)],from,to)));
 assert.equal(distance([wall(.25,-6,-.05),wall(.25,.05,6)],from,to),Infinity);
});
test('reward only increases for new own progress; retreats, hovering, allies and unreachable routes cannot farm it',()=>{
 const r=new ApproachRewards(2),owner={id:0,team:0},target={id:1,team:1};
 r.record(owner,target,100,80);assert.equal(r.scores[0],.2);
 r.record(owner,target,80,100);r.record(owner,target,100,80);assert.equal(r.scores[0],.2);
 r.record(owner,target,80,80);r.record(owner,target,Infinity,20);
 r.record(owner,{id:2,team:0},100,20);assert.equal(r.scores[0],.2);
 r.record(owner,target,80,60);assert(Math.abs(r.scores[0]-.4)<1e-10);
 for(let id=2;id<20;id++)r.record(owner,{id,team:1},120,20);
 assert.equal(r.scores[0],1);
 assert.equal(matchFitness({winner:null,approach:r.scores},0),.15);
 assert(matchFitness({winner:null,wallEliminations:[1]},0)>.15);
});
const fixture=()=>({time:0,crashes:[],trails:[],cycles:[
 {id:0,team:0,x:0,z:0,alive:true},
 {id:1,team:1,x:20,z:0,alive:true},
]});
test('sampling isolates own motion from an opponent approaching and respects current disconnection',()=>{
 const race=fixture(),reward=new ApproachRewards(2);
 reward.sample(race);race.cycles[1].x=15;reward.sample(race);
 assert.equal(reward.scores[0],0);assert(reward.scores[1]>0);
 race.cycles[0].x=3;reward.sample(race);assert(reward.scores[0]>0);
 const previous=reward.scores[0];
 race.cycles[0].x=4;
 race.trails=[{bikeId:1,x1:8,z1:-86,x2:8,z2:86,startsRun:true}];
 reward.sample(race);assert.equal(reward.scores[0],previous);
});
test('stationary cycles gain nothing when walls disappear and team normalization survives deaths',()=>{
 const race=fixture();race.cycles.push({id:2,team:1,x:20,z:10,alive:true});
 race.trails=[{bikeId:1,x1:8,z1:-86,x2:8,z2:86,startsRun:true}];
 const reward=new ApproachRewards(2);reward.sample(race);
 assert.equal(reward.opportunities[0],2);
 race.trails=[];reward.sample(race);assert.equal(reward.scores[0],0);
 reward.record(race.cycles[0],race.cycles[1],120,20);assert.equal(reward.scores[0],.5);
 race.cycles[2].alive=false;reward.sample(race);
 assert.equal(reward.opportunities[0],2);assert.equal(reward.scores[0],.5);
});
test('offline reward instrumentation does not change deterministic match outcomes',()=>{
 const plain=match({seed:1982,mode:'bounded',seconds:2});
 const measured=match({seed:1982,mode:'bounded',seconds:2,approach:true});
 for(const key of ['winner','ticks','alive','turns','trailCount','wallEliminations','decisions'])assert.deepEqual(measured[key],plain[key]);
 assert.equal(measured.approachSamples,2);assert(measured.approachMs>0);
});
