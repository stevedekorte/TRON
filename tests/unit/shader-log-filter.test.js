import test from 'node:test';
import assert from 'node:assert/strict';
import {filterShaderLog, installShaderLogFilter} from '../../src/rendering/shader-log-filter.js';
import {warn, log, setConsoleFunction} from 'three';

const d3dLog = [
  '(556,21-103): warning X4008: floating point division by zero',
  '(556,21-103): warning X4008: floating point division by zero',
  '(380,12-86): warning X3595: gradient instruction used in a loop with varying iteration; partial derivatives may have undefined value',
  '(68,5-25): warning X3577: value cannot be NaN, isnan() may not be necessary.  /Gis may force isnan() to be performed',
].join('\n');

test('collapses only the expected Direct3D warnings', () => {
  const result = filterShaderLog(d3dLog + '\n(428,9-52): error X3067: \'vec3_ctor_int_int\': ambiguous function call');
  assert.deepEqual(result.counts, {X4008: 2, X3595: 1, X3577: 1});
  assert.equal(result.log, '(428,9-52): error X3067: \'vec3_ctor_int_int\': ambiguous function call');
});

test('three.js program logs print one summary; other messages pass through', () => {
  const calls = [];
  const target = {info: (...a) => calls.push(['info', ...a]), warn: (...a) => calls.push(['warn', ...a]), log: (...a) => calls.push(['log', ...a])};
  installShaderLogFilter(target);
  try {
    warn('WebGLProgram: Program Info Log:', d3dLog);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'info');
    assert.match(calls[0][1], /4 expected Direct3D compiler warnings collapsed \(X4008×2, X3595×1, X3577×1\)/);
    warn('WebGLProgram: Program Info Log:', 'other driver warning');
    assert.deepEqual(calls.at(-1), ['warn', 'THREE.WebGLProgram: Program Info Log:', 'other driver warning']);
    log('WebGLRenderer: Context Lost.');
    assert.deepEqual(calls.at(-1), ['log', 'THREE.WebGLRenderer: Context Lost.']);
  } finally {
    setConsoleFunction(null);
  }
});
