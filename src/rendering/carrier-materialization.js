import * as THREE from 'three';
import { CARRIER } from '../game/carrier.js';
import { Materialization } from './materialization.js';
import { MATERIALIZATION, materializationPhase } from '../game/materialization.js';

export const CARRIER_REZ_PANEL = Object.freeze({
  fillColor: 0xb7c5de,
  rimColor: 0xffd83d,
  fillOpacity: 0.5,
  rimOpacity: 0.9,
  rimInset: 0.012,
  rimHalfWidth: 0.003,
  edgeSoftness: 0.065,
  pulseHz: 7,
  pulseDepth: 0.22,
});

// The carrier travels along +X. In the reveal frame, z=-x, so the bow is
// revealed first. Moving the local cut at ship speed cancels world translation.
export class CarrierMaterialization extends Materialization {
  constructor(root,options={}) {
    super(root, {
      axis: 'x', reverse: true, wireFog: false,
      // Keep the revealed running lights/trim emissive while armor is wireframe.
      // They emerge through the same plane, never ahead of the incoming bow.
      isLiveMaterial: material => material.name.startsWith('TxTC') && !material.name.startsWith('TxTC01'),
      ...options,
    });
    this.lineMaterial.color.setRGB(...CARRIER.materializationWireColorLinear);
    // Film reference, Carrier derezed 2:37–2:38: a milky translucent field,
    // soft edges; the yellow pulsing rim and clear inner margin follow the user’s refinement.
    const panel = this.rectangle.material;
    panel.blending = THREE.NormalBlending;
    Object.assign(panel.uniforms, {
      panelPulse: {value: 1},
      fillColor: {value: new THREE.Color(CARRIER_REZ_PANEL.fillColor)},
      rimColor: {value: new THREE.Color(CARRIER_REZ_PANEL.rimColor)},
      fillOpacity: {value: CARRIER_REZ_PANEL.fillOpacity},
      rimOpacity: {value: CARRIER_REZ_PANEL.rimOpacity},
      rimInset: {value: CARRIER_REZ_PANEL.rimInset},
      rimHalfWidth: {value: CARRIER_REZ_PANEL.rimHalfWidth},
      edgeSoftness: {value: CARRIER_REZ_PANEL.edgeSoftness},
    });
    panel.fragmentShader = `
      varying vec2 uvRez;
      uniform float strength, lineStrength, fillOpacity, rimOpacity, edgeSoftness, panelPulse, rimInset, rimHalfWidth;
      uniform vec3 fillColor, rimColor;
      void main() {
        vec2 edge = min(uvRez, 1. - uvRez);
        float distanceToEdge = min(edge.x, edge.y);
        float aa = max(fwidth(distanceToEdge), .0005);
        // The gray fill reaches zero at the inner edge of the yellow rim.
        float innerRim = rimInset + rimHalfWidth + aa;
        float face = smoothstep(innerRim, innerRim + edgeSoftness, distanceToEdge);
        float rim = (1. - smoothstep(rimHalfWidth, rimHalfWidth + aa, abs(distanceToEdge - rimInset)))
          * smoothstep(0., aa, distanceToEdge);
        float fill = fillOpacity * face;
        float outline = rimOpacity * rim;
        vec3 milk = fillColor * mix(.8, 1., uvRez.y);
        float alpha = fill + outline + lineStrength * .65;
        vec3 color = (milk * (fill + lineStrength * .65) + rimColor * outline) / max(alpha, .0001);
        gl_FragColor = vec4(color, strength * alpha * panelPulse);
        #include <colorspace_fragment>
      }
    `;
    panel.needsUpdate = true;
  }
  updateTransit(time, speed) {
    const {openSeconds, sweepClearance} = MATERIALIZATION;
    const fadeSeconds = CARRIER.materializationFadeSeconds;
    const from = this.bounds.min.z - sweepClearance - speed * openSeconds;
    const cut = from + speed * time;
    const endTime = (this.bounds.max.z + sweepClearance - from) / speed;
    const blend = Math.max(0, Math.min(1, (time - endTime) / fadeSeconds));
    const solid = blend * blend * (3 - 2 * blend);
    const phase = {
      ...materializationPhase(time),
      solid,
      opacity: 1 - solid,
      complete: time >= endTime + fadeSeconds,
    };
    this.update(time, null, {phase, cut});
    const pulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * CARRIER_REZ_PANEL.pulseHz * time);
    this.rectangle.material.uniforms.panelPulse.value = 1 - CARRIER_REZ_PANEL.pulseDepth * pulse;
  }
}
