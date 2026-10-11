import {LIGHT_CYCLES} from '../game/light-cycles.js';

export class CycleRoster{
 constructor(element){this.element=element;this.signature='';}
 update(race,visible){
  this.element.hidden=!visible;if(!visible||!race)return;
  const cycles=[...race.cycles].sort((a,b)=>a.team-b.team||a.id-b.id);
  const signature=cycles.map(c=>`${c.id}:${c.team}:${+c.alive}`).join('|');
  if(signature===this.signature)return;this.signature=signature;
  const groups=new Map();
  for(const cycle of cycles){
   const team=LIGHT_CYCLES.teamNames[cycle.team];
   if(!groups.has(cycle.team)){
    const group=document.createElement('div');group.className='cycle-team-icons';group.setAttribute('role','group');group.setAttribute('aria-label',team+' team');groups.set(cycle.team,group);
   }
   const group=groups.get(cycle.team),icon=document.createElement('span');
   icon.className='cycle-roster-icon'+(cycle.alive?'':' eliminated');icon.dataset.cycleId=String(cycle.id);
   icon.style.color='#'+LIGHT_CYCLES.colors[cycle.team].toString(16).padStart(6,'0');
   const label=`${team} cycle ${group.children.length+1} — ${cycle.alive?'active':'eliminated'}`;
   icon.setAttribute('role','img');icon.setAttribute('aria-label',label);icon.title=label;
   group.append(icon);
  }
  this.element.replaceChildren(...groups.values());
 }
}
