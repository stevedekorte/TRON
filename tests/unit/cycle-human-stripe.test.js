import test from 'node:test';
import assert from 'node:assert/strict';
import {HUMAN_STRIPE,HUMAN_STRIPE_PATTERNS,humanStripeGLSL} from '../../src/rendering/cycle-human-stripe.js';
import {MP} from '../../shared/multiplayer/config.js';

test('human stripe GLSL has three patterns and well-formed numeric literals',()=>{
 assert.equal(HUMAN_STRIPE_PATTERNS.length,MP.maxCyclesPerTeam,'one pattern per possible human on a team');
 // A negative constant after a minus once produced "--0.12", which fails to compile.
 assert(!/[-+]\s*-\d/.test(humanStripeGLSL),'no doubled signs before a literal');
 assert(/humanStripe>2\.5/.test(humanStripeGLSL)&&/humanStripe>1\.5/.test(humanStripeGLSL),'pattern branches');
 const {doubleHalfWidthMeters:w,doubleOffsetMeters:o,bodyLimitMeters:limit}=HUMAN_STRIPE;
 assert(o>w,'the two slashes of pattern 2 do not merge');assert(o+w<limit,'pattern 2 stays on the body panel');
});
