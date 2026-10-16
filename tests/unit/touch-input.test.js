import test from 'node:test';
import assert from 'node:assert/strict';
import {InputController} from '../../src/app/input-controller.js';
test('touch pedals share keyboard commands, brake wins, and focus clearing releases them',()=>{
 const input=new InputController(),run={playerVehicle:'cycle',cycleRace:{playerId:0,cycles:[{}]}};
 input.touchKeys.add('KeyW');assert(input.command(run).cycleTurbo);
 input.queueCycleTurn(-1);assert.equal(input.command(run).cycleTurn,-1);input.consume();assert(input.command(run).cycleTurbo);
 input.touchKeys.add('KeyS');assert(input.command(run).cycleSlow);assert(!input.command(run).cycleTurbo);
 input.keys.add('KeyW');input.touchKeys.clear();assert(input.command(run).cycleTurbo,'releasing touch does not release the physical keyboard');
 input.touchKeys.add('KeyS');input.clearKeys();assert(!input.command(run).cycleSlow&&!input.command(run).cycleTurbo);
});
