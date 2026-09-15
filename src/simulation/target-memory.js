// A confirmed derezzing supersedes every older sighting until the next run.
export function retireTarget(e) {
  if(e.targetGone)return;
  e.spotlight=null;e.alertUntil=0;e.targetGone=true;e.canSee=false;e.memory=null;e.goal=null;e.goalUntil=0;e.searchIndex=0;
  if(e.attack){
    if(e.attack.phase==='fold'||e.attack.phase==='drop'){e.attack.phase='rise';e.attack.impact=false;}
    e.state='recover';
  }else if(e.state!=='destroyed')e.state='wander';
}
