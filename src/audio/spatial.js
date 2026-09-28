// Preserve the sample's stereo channels as two nearby world-space emitters.
// Each ear receives Web Audio HRTF filtering, distance attenuation and motion.
export function stereoEmitter(c,destination,refDistance=35,halfWidth=2.4) {
  const input=c.createChannelSplitter(2),gain=c.createGain();gain.gain.value=0;gain.connect(destination);
  const panners=[0,1].map(channel=>{
    const p=c.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';
    p.refDistance=refDistance;p.maxDistance=900;p.rolloffFactor=1.1;
    input.connect(p,channel);p.connect(gain);return p;
  });
  return {input,gain,panners,position(x,y,z,yaw){
    panners.forEach((p,i)=>{
      const offset=(i?1:-1)*halfWidth,px=x+Math.cos(yaw)*offset,pz=z-Math.sin(yaw)*offset;
      if(p.positionX){p.positionX.value=px;p.positionY.value=y;p.positionZ.value=pz;}
      else p.setPosition(px,y,pz);
    });
  }};
}
export function doppler(e,run) {
  const dx=e.x-run.x,ds=e.s-run.s,d=Math.hypot(dx,ds,e.y-(run.y??3))||1;
  const source=(e.vx*dx+e.vs*ds+e.vy*(e.y-(run.y??3)))/d;
  const listener=((run.vx??-Math.sin(run.yaw)*run.speed)*dx+(run.vs??Math.cos(run.yaw)*run.speed)*ds+(run.vy||0)*(e.y-(run.y??3)))/d;
  return Math.max(.85,Math.min(1.18,(343+listener)/(343+source)));
}
