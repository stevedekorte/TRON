import {writeFile,mkdir} from 'node:fs/promises';
import {match} from './benchmark.mjs';
const count=Number(process.argv[2]??4),rows=[];
for(let i=0;i<count;i++)for(let seat=0;seat<4;seat++){
 const policies=Array(4).fill('classic');policies[seat]=undefined;
 const result=match({seed:2200+i,mode:'bounded',seconds:180,policies,measure:true});rows.push({seat,...result});console.log(JSON.stringify(rows.at(-1)));
}
const summary={wallEliminations:rows.reduce((sum,r)=>sum+r.wallEliminations[r.seat],0),matches:rows.length,wins:rows.filter(r=>r.winner===r.seat).length,draws:rows.filter(r=>r.winner==null).length,notes:'Four spawn rotations per seed; not statistically independent evidence of general strength.'};
await mkdir('test-results',{recursive:true});
await writeFile('test-results/cycle-ai-comparison.json',JSON.stringify({summary,rows},null,2)+'\n');console.log(JSON.stringify(summary));
