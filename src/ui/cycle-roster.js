import {LIGHT_CYCLES} from '../../shared/simulation/config/light-cycles.js';

export class CycleRoster{
 constructor(element){this.element=element;this.signature='';}
 update(race,visible,waiting=0){
  this.element.hidden=!visible;if(!visible||!race)return;
  const cycles=[...race.cycles].sort((a,b)=>a.team-b.team||a.id-b.id);
  const queueCount=visible?Math.max(0,Math.floor(waiting||0)):0;
  const signature=queueCount+':'+cycles.map(c=>`${c.id}:${c.team}:${+c.alive}:${!!c.human}:${c.id===race.playerId}:${race.localPlayerId}`).join('|');
  if(signature===this.signature)return;this.signature=signature;
  const groups=new Map();
  for(const cycle of cycles){
   const team=LIGHT_CYCLES.teamNames[cycle.team];
   if(!groups.has(cycle.team)){
    const group=document.createElement('div');group.className='cycle-team-icons';group.setAttribute('role','group');group.setAttribute('aria-label',team+' team');groups.set(cycle.team,group);
   }
   const group=groups.get(cycle.team),icon=document.createElement('span');
   icon.className='cycle-roster-icon'+(cycle.alive?'':' eliminated')+(cycle.human?' human':'')+(cycle.human&&cycle.id===race.localPlayerId?' local-player':'');icon.dataset.cycleId=String(cycle.id);
   icon.style.color='#'+LIGHT_CYCLES.colors[cycle.team].toString(16).padStart(6,'0');
   const label=`${team} cycle ${group.children.length+1} — ${cycle.alive?'active':'eliminated'}${cycle.human?' · '+cycle.operator:' · AI'}`;
   icon.setAttribute('role','img');icon.setAttribute('aria-label',label);icon.title=label;
   group.append(icon);
  }
  const queue=document.createElement('div');queue.className='cycle-waiting-queue';queue.hidden=queueCount===0;queue.setAttribute('role','group');queue.setAttribute('aria-label',`${queueCount} players waiting to enter`);
  const icons=document.createElement('div');icons.className='cycle-team-icons';
  for(let i=0;i<queueCount;i++){
   const icon=document.createElement('span');icon.className='cycle-roster-icon eliminated';icon.setAttribute('role','img');icon.setAttribute('aria-label',`Waiting player ${i+1}`);icons.append(icon);
  }
  const arrow=document.createElement('span');arrow.className='cycle-queue-arrow';arrow.setAttribute('aria-hidden','true');
  queue.append(icons,arrow);
  this.element.replaceChildren(...groups.values(),...(queueCount?[queue]:[]));
 }
}
