// Small, local film-style spoke glints. Normal travel alternates at 24 states
// per second (12 flashes); slow travel and turbo scale the cadence in seconds.
export const CYCLE_WHEEL_REFLECTIONS=Object.freeze({referenceSpeedMetersPerSecond:38.4,normalFlashesPerSecond:12,maxFlashesPerSecond:24,fadeInSpeedMetersPerSecond:2,innerRadiusMeters:.14,outerRadiusMeters:.38,halfWidthRadians:.065,intensity:.9});
export function advanceWheelReflection(state,time,speed){
 const dt=state?Math.max(0,time-state.time):0;
 const rate=Math.min(CYCLE_WHEEL_REFLECTIONS.maxFlashesPerSecond,Math.abs(speed)/CYCLE_WHEEL_REFLECTIONS.referenceSpeedMetersPerSecond*CYCLE_WHEEL_REFLECTIONS.normalFlashesPerSecond);
 return {time,phase:((state?.phase??0)+dt*rate)%1024,strength:Math.min(1,Math.abs(speed)/CYCLE_WHEEL_REFLECTIONS.fadeInSpeedMetersPerSecond)};
}

// The glint itself, shared by the POV-Ray renderer and the POV-Ray mesh in the
// normal renderer. Cycle-local metres (POV-Ray coordinates); material 2 is the
// black hub disc, whose faces point along local ±X.
const WHEEL_CENTER_Z=177.5*3.6/525,AXLE_HEIGHT=85*3.6/525;
export const wheelReflectionGLSL=`
uniform float wheelPhase,wheelGlintStrength;
float wheelReflection(vec3 point,vec3 normal,int material){
 if(material!=2||abs(normal.x)<.9||wheelGlintStrength<=0.)return 0.;
 // Both wheel discs share the original analytic model's axle height and centers.
 float center=point.z<0.?-${WHEEL_CENTER_Z}:${WHEEL_CENTER_Z};
 vec2 radial=vec2(point.z-center,point.y-${AXLE_HEIGHT});
 float radius=length(radial),aa=max(fwidth(radius),.0005);
 float ring=smoothstep(${CYCLE_WHEEL_REFLECTIONS.innerRadiusMeters}-aa,${CYCLE_WHEEL_REFLECTIONS.innerRadiusMeters}+aa,radius)*(1.-smoothstep(${CYCLE_WHEEL_REFLECTIONS.outerRadiusMeters}-aa,${CYCLE_WHEEL_REFLECTIONS.outerRadiusMeters}+aa,radius));
 float angle=-2.1+.12*sin(wheelPhase*.7);
 float delta=abs(atan(sin(atan(radial.y,radial.x)-angle),cos(atan(radial.y,radial.x)-angle)));
 float edge=max(fwidth(delta),.001);
 float spoke=1.-smoothstep(${CYCLE_WHEEL_REFLECTIONS.halfWidthRadians}-edge,${CYCLE_WHEEL_REFLECTIONS.halfWidthRadians}+edge,delta);
 float phase=fract(wheelPhase);
 float flash=smoothstep(0.,.04,phase)*(1.-smoothstep(.46,.5,phase));
 return ring*spoke*flash*wheelGlintStrength;
}
`;
