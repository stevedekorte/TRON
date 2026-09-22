import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createScenario} from '../src/levels/scenario.js';
import {GameSession} from '../src/simulation/game-session.js';
import {Autoplay} from '../src/simulation/autoplay.js';
const args=new Map();for(let i=2;i<process.argv.length;i+=2)args.set(process.argv[i],process.argv[i+1]);
const {world}=createScenario({layout:args.get('--layout')||'blueprint',layoutSeed:Number(args.get('--layout-seed')||1982),runSeed:Number(args.get('--seed')||1982)});
const seconds=Number(args.get('--seconds')||720);if(!Number.isFinite(seconds)||seconds<=0||seconds>3600)throw new Error('Expected 0–3600 seconds');
const session=new GameSession({world,seed:world.spec.runSeed}),pilot=new Autoplay();
session.run.recognizers=[];session.run.enemyTanks=[];pilot.setEnabled(true);
const captures=[],events=[];let idle=0;
for(let i=0;i<seconds*60;i++){
 const command=pilot.input(session.run);session.advance(command,1/60);
 const r=session.run;
 if(r.dataCollected>captures.length)captures.push({time:r.time,beams:r.dataBeams.filter(b=>b.collectedAt!==null).map(b=>b.id)});
 idle=!r.transferActive&&Math.abs(r.speed)<.1&&Math.abs(command.steer||0)<.001?idle+1:0;
 if(i%600===0||idle===180)events.push(pilot.diagnostics(r));
 if(idle>=1200)break; // Diagnostic stop, not a claim that all beams should be reachable.
}
const output=args.get('--output')||'test-results/autoplay-replay.json';mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify({scenario:session.run.scenario,seconds:session.run.time,captures,stalledSeconds:idle/60,final:pilot.diagnostics(session.run),events},null,2));
console.log(JSON.stringify({output,seconds:session.run.time,captures,stalledSeconds:idle/60}));
