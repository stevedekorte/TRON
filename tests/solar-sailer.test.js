import test from 'node:test';
import assert from 'node:assert/strict';
import { solarSailerPose, SOLAR_SAILER } from '../src/game/solar-sailer.js';
import { DEFAULT_WORLD } from '../src/levels/scenario.js';
import { carrierFor } from '../src/game/carrier.js';

test('Solar Sailer crosses a fixed elevated +X lane and repeats without visible wrapping', () => {
  const c = SOLAR_SAILER, world = DEFAULT_WORLD;
  assert.equal(solarSailerPose(0, world).visible, false);
  const a = solarSailerPose(c.firstPassSeconds + 20, world);
  const b = solarSailerPose(c.firstPassSeconds + 21, world);
  assert.equal(b.x - a.x, c.speedMetersPerSecond);
  assert.equal(a.z, b.z);
  assert.equal(a.y, c.altitudeMeters);
  assert.equal(a.z, -(carrierFor(world).s + c.carrierOffsetMeters));
  assert.deepEqual(a, solarSailerPose(c.firstPassSeconds + 20 + c.periodSeconds, world));
  assert.equal(solarSailerPose(c.firstPassSeconds, world).opacity, 0);
  assert.equal(solarSailerPose(c.firstPassSeconds + c.travelMeters / c.speedMetersPerSecond + 1, world).visible, false);
  assert.equal(solarSailerPose(30, world, {...c, enabled:false}).visible, false);
});


test('beam anticipates each pass, fades afterward and stays dark between crossings', () => {
  const c = SOLAR_SAILER;
  const opacity = time => solarSailerPose(time, DEFAULT_WORLD).beamOpacity;
  const start = c.firstPassSeconds, end = start + c.travelMeters / c.speedMetersPerSecond;
  const fade = c.beamFadeInSeconds, fadeOut = c.beamFadeOutSeconds;
  assert.equal(opacity(0), 0);
  assert.equal(opacity(120), 0);
  assert.equal(solarSailerPose(120, DEFAULT_WORLD).visible, false);
  for (const offset of [0, c.periodSeconds, 2 * c.periodSeconds]) {
    assert.equal(opacity(start + offset - fade), 0);
    assert(Math.abs(opacity(start + offset - fade / 2) - 0.5) < 1e-10);
    assert.equal(opacity(start + offset), 1);
    assert.equal(opacity(end + offset), 1);
    assert(Math.abs(opacity(end + offset + fadeOut / 2) - 0.5) < 1e-10);
    assert.equal(opacity(end + offset + fadeOut + 0.01), 0);
    assert.equal(opacity(start + offset + c.periodSeconds / 1.5), 0);
  }
  assert.equal(solarSailerPose(start, DEFAULT_WORLD, {...c, enabled:false}).beamOpacity, 0);
});
