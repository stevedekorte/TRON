import * as THREE from 'three';

// The film's cannon flash is a broad scalloped cyan star, visible for a few frames.
export function createMuzzleFlash(){
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
  uniforms:{age:{value:1},seed:{value:0}},
  vertexShader:'varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec2 p;uniform float age;uniform float seed;
  void main(){
   float r=length(p),a=atan(p.y,p.x);
   float shape=.6+.16*pow(.5+.5*sin(a*17.+seed),3.)+.065*sin(a*7.+seed);
   float envelope=(1.-smoothstep(.075,.17,age))*smoothstep(0.,.009,age);
   float size=mix(1.18,.7,clamp(age/.17,0.,1.));
   float core=(1.-smoothstep(shape*size-.012,shape*size+.012,r))*envelope;
   float halo=exp(-r*r/.42)*envelope*.42;
   gl_FragColor=vec4(vec3(.8,2.1,2.3)*core+vec3(.015,.3,1.)*halo,clamp(core+halo,0.,1.));
  }`});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(8,8),material);mesh.visible=false;return mesh;
}
