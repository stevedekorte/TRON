// ANGLE's Direct3D backend (Windows browsers) reports the HLSL compiler's
// warnings in the program info log, and three.js prints that log. The compiler
// repeats a warning for every unrolled loop copy, so one large shader (the
// POV-Ray cycle CSG kernel) prints thousands of identical lines. These codes
// are expected for this project's shaders and do not affect output:
// X3595 derivatives in a loop with varying iteration, X4008 division by zero
// (intentional infinities in ray/slab tests), X3577 isnan() assumed false.
// Every other line, including errors, is still printed.
import {setConsoleFunction} from 'three';

export const BENIGN_SHADER_WARNINGS = Object.freeze(['X3595', 'X4008', 'X3577']);
const PROGRAM_LOG = 'Program Info Log';
const warningPattern = new RegExp(`warning (${BENIGN_SHADER_WARNINGS.join('|')}):`);

/** Returns {log, counts}: the log without benign lines, and how many were removed per code. */
export function filterShaderLog(log) {
  const counts = {}, kept = [];
  for (const line of String(log).split('\n')) {
    const code = line.match(warningPattern)?.[1];
    if (code) counts[code] = (counts[code] ?? 0) + 1;
    else kept.push(line);
  }
  return {log: kept.join('\n').trim(), counts};
}

export function installShaderLogFilter(target = console) {
  setConsoleFunction((type, message, ...params) => {
    if (type === 'warn' && String(message).includes(PROGRAM_LOG) && typeof params[0] === 'string') {
      const {log, counts} = filterShaderLog(params[0]);
      const removed = Object.entries(counts);
      if (removed.length) {
        target.info(`${message.replace(/:\s*$/, '')}: ${removed.reduce((n, [, c]) => n + c, 0)} expected Direct3D compiler warnings collapsed (${removed.map(([code, c]) => `${code}×${c}`).join(', ')}).`);
      }
      if (log) target.warn(message, log, ...params.slice(1));
      return;
    }
    target[type](message, ...params);
  });
}
