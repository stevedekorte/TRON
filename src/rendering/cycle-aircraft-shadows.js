import {createCycleAtlasShadowBinding} from './cycle-atlas-shadows.js';

export const CYCLE_AIRCRAFT_SHADOWS=Object.freeze({maxCasters:17,darkness:.78,depthBias:.0002});
const binding=createCycleAtlasShadowBinding({prefix:'aircraft',...CYCLE_AIRCRAFT_SHADOWS});
export const cycleAircraftShadowGLSL=binding.glsl;
export const createCycleAircraftShadowUniforms=binding.createUniforms;
export const updateCycleAircraftShadowUniforms=binding.update;
