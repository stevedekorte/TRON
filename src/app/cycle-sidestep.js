// Arena sidestep: holding Q turns the cycle left and releasing it turns back right,
// ending on the original heading one short jog over (E mirrors it). The camera
// keeps the original heading for the whole hold. Only one key works at a time;
// while it is held other turns are ignored (turbo and brake are unaffected).
// Death, a new round or leaving the arena drops the sidestep without the return turn.
export const CYCLE_SIDESTEP=Object.freeze({turns:Object.freeze({KeyQ:-1,KeyE:1})});

/** Arena heading (0-3, as cycle.dir) after the turns still waiting to be applied. */
export function headingAfter(dir,queuedTurns=[]){return ((dir+queuedTurns.reduce((a,t)=>a+Math.sign(t),0))%4+4)%4;}

export class CycleSidestep{
 constructor(){this.active=null;}
 get lockYaw(){return this.active?this.active.yaw:null;}
 /** Returns the turn to queue now (-1 left, 1 right), or 0 if the press is ignored. */
 press(key,{eligible=false,dir=0,round=0}={}){
  const turn=CYCLE_SIDESTEP.turns[key];
  if(this.active||!turn||!eligible)return 0;
  this.active={key,turn,round,yaw:-dir*Math.PI/2};
  return turn;
 }
 /** Call each running frame. Returns the return turn on release, else 0. */
 update(held,{valid=false,round=0}={}){
  const a=this.active;if(!a)return 0;
  if(!valid||round!==a.round){this.active=null;return 0;}
  if(held.has(a.key))return 0;
  this.active=null;return -a.turn;
 }
 cancel(){this.active=null;}
}
