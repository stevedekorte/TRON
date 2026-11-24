// Several rendered humans (TRON_MP_HUMANS, default 4) share one multiplayer
// arena and steer at random for several rounds. Each client's view is compared
// with the others: rounds, seats, humans, alive cycles, and its own cycle.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.env.TRON_URL||'http://127.0.0.1:5173/';
const humans=Number(process.env.TRON_MP_HUMANS||4),rounds=Number(process.env.TRON_MP_ROUNDS||3);
const out='test-results/multiplayer/multiplayer-many-humans';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
const problems=[],log=[],note=(kind,detail)=>{const key=kind+JSON.stringify(detail);if(!problems.some(p=>p.key===key)){problems.push({key,kind,detail});console.log('PROBLEM',kind,JSON.stringify(detail));}};
try{
 const pages=[];
 for(let i=0;i<humans;i++){
  const context=await browser.newContext({viewport:{width:900,height:600},reducedMotion:'reduce'});
  await context.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
  const page=await context.newPage();page.index=i;
  page.on('pageerror',e=>note('page error',{client:i,message:e.message}));
  page.on('console',m=>{if(m.type()==='error')note('console error',{client:i,text:m.text().slice(0,200)});});
  await page.goto(base);await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-multiplayer').disabled,null,{timeout:120000});
  await page.locator('#start-multiplayer').click();
  await page.waitForFunction(()=>__tron.state.playerVehicle==='cycle'&&__tron.state.multiplayer?.connected,null,{timeout:60000});
  pages.push(page);
 }
 const sample=page=>page.evaluate(()=>{
  const s=__tron.state,r=s.cycleRace,m=s.multiplayer;
  return {mode:s.mode,round:r.round,phase:r.phase,staging:!!r.cameraStaging,seat:m?.seat,playerId:r.playerId,players:m?.players,connected:m?.connected,
   spectating:!!s.cycleSpectating,follow:s.cycleFollowId,teamCount:r.teamCount,cycles:r.cycles.length,
   alive:r.cycles.filter(b=>b.alive).map(b=>b.id),humans:r.cycles.filter(b=>b.human).map(b=>b.id),patterns:r.cycles.map(b=>b.human?b.pattern??null:null),
   teams:r.cycles.map(b=>b.team),pos:r.cycles.map(b=>[+(b.x).toFixed(2),+(b.z).toFixed(2)]),
   prompt:document.querySelector('#cycle-controls')?.textContent??'',canRestart:m?.canRestart};
 });
 const keys=['KeyA','KeyD'];const positionsChecked=new Set(),racingSince={};let firstRound=null;let seenRounds=new Set(),lastRoundChange=Date.now(),lastRound=null,shots=0;
 const deadline=Date.now()+rounds*150e3;
 while(Date.now()<deadline){
  // Each living human steers at random; dead ones press Return now and then.
  await Promise.all(pages.map(async p=>{
   const r=Math.random();
   if(r<.25)await p.keyboard.press(keys[Math.random()<.5?0:1]);
   else if(r<.3){await p.keyboard.down('KeyW');setTimeout(()=>p.keyboard.up('KeyW').catch(()=>{}),600);}
  }));
  await new Promise(r=>setTimeout(r,300));
  const states=await Promise.all(pages.map(sample));
  const t=Date.now();log.push({t,states});
  const round=Math.max(...states.map(s=>s.round));
  if(firstRound==null)firstRound=round;if(round!==lastRound){lastRound=round;lastRoundChange=t;seenRounds.add(round);console.log(`round ${round}: teams ${states[0].teamCount}, cycles ${states[0].cycles}, seats ${states.map(s=>s.seat).join(',')}, humans ${states[0].humans.join(',')}`);}
  // Consistency checks between clients on the same round.
  const same=states.filter(s=>s.round===round);
  if(same.length===states.length){
   const seats=states.map(s=>s.seat);
   if(states.every(s=>!s.staging)){
    if(round>firstRound&&seats.some(x=>x==null))note('unseated human',{round,seats});
    const seated=seats.filter(x=>x!=null);if(new Set(seated).size!==seated.length)note('duplicate seat',{round,seats});
    for(const s of states){
     const hs=[...s.humans].sort((a,b)=>a-b).join(),expect=[...seats].filter(x=>x!=null).sort((a,b)=>a-b).join();
     if(hs!==expect)note('human flags differ from seats',{round,client:states.indexOf(s),humans:s.humans,seats});
     if(s.seat!=null&&s.playerId!==s.seat)note('playerId differs from seat',{round,client:states.indexOf(s),seat:s.seat,playerId:s.playerId});
     if(s.players!==humans)note('player count',{round,client:states.indexOf(s),players:s.players});
     if(s.seat!=null&&s.alive.includes(s.seat)&&s.spectating)note('spectating while alive',{round,client:states.indexOf(s)});
    }
    // Stripe patterns: the same on every client, 1–3, unique among a team's humans.
    if(new Set(states.map(s=>JSON.stringify(s.patterns))).size>1)note('clients disagree on stripe patterns',{round,patterns:states.map(s=>s.patterns)});
    for(const team of new Set(states[0].teams)){
     const p=states[0].patterns.filter((x,i)=>x!=null&&states[0].teams[i]===team);
     if(p.some(x=>![1,2,3].includes(x))||new Set(p).size!==p.length)note('stripe patterns not unique within a team',{round,team,patterns:p});
    }
    if(states.every(s=>s.seat!=null)&&!log.some(l=>l.patternsLogged===round)){log.at(-1).patternsLogged=round;console.log('  patterns by seat',JSON.stringify(Object.fromEntries(seats.map((x,i)=>['client'+i,states[0].patterns[x]]))));}
    const teamsOf=states[0].teams,ht=seats.map(x=>teamsOf[x]);
    const perTeam={};for(const team of ht)perTeam[team]=(perTeam[team]??0)+1;
    if(states[0].phase==='racing'&&!log.some(l=>l.teamsLogged===round)){log.at(-1).teamsLogged=round;console.log(`  human teams ${JSON.stringify(perTeam)}`);}
   }
   // Alive sets: allow one snapshot of lag between clients.
   const sets=states.map(s=>s.alive.join());
   if(new Set(sets).size>1){
    const prev=log.at(-2)?.states;if(prev&&new Set(prev.map(s=>s.alive.join())).size>1&&prev.every(s=>s.round===round))note('alive sets disagree',{round,alive:states.map(s=>s.alive)});
   }
   // Positions: every client records each frame with wall-clock time; compare
   // views of the same cycle at the same instant (interpolated).
   if(states.every(s=>s.phase==='racing'&&!s.staging))racingSince[round]??=t;else delete racingSince[round];
   // Sample 4 s into the race, past the launch, when every test browser briefly drops frames.
   if(t-(racingSince[round]??t)>4000&&!positionsChecked.has(round)&&states.every(s=>s.seat!=null)){
    positionsChecked.add(round);
    const tracks=await Promise.all(pages.map(p=>p.evaluate(()=>new Promise(done=>{const out=[],end=performance.now()+2500;
     const f=()=>{const r=__tron.state.cycleRace;out.push({t:Date.now(),round:r.round,pos:r.cycles.map(b=>b.alive?[b.x,b.z]:null)});performance.now()<end?requestAnimationFrame(f):done(out);};requestAnimationFrame(f);}))));
    const at=(track,t,id)=>{for(let i=1;i<track.length;i++)if(track[i].t>=t){const a=track[i-1],b=track[i],pa=a.pos[id],pb=b.pos[id];if(!pa||!pb||a.round!==round||b.round!==round)return null;const u=(t-a.t)/Math.max(1,b.t-a.t);return [pa[0]+(pb[0]-pa[0])*u,pa[1]+(pb[1]-pa[1])*u];}return null;};
    const t0=Math.max(...tracks.map(k=>k[0].t))+50,t1=Math.min(...tracks.map(k=>k.at(-1).t))-50,fps=tracks.map(k=>+(k.length/2.5).toFixed(0));
    const remote=[],own=[];
    for(let t=t0;t<t1;t+=50)for(let id=0;id<states[0].cycles;id++){
     const views=tracks.map((k,c)=>({c,p:at(k,t,id),own:states[c].seat===id})).filter(v=>v.p);
     const others=views.filter(v=>!v.own),mine=views.find(v=>v.own);
     for(const a of others)for(const b of others)if(a.c<b.c)remote.push(Math.hypot(a.p[0]-b.p[0],a.p[1]-b.p[1]));
     if(mine)for(const a of others)own.push(Math.hypot(a.p[0]-mine.p[0],a.p[1]-mine.p[1]));
    }
    const stat=v=>{v.sort((a,b)=>a-b);return v.length?{n:v.length,median:+v[v.length>>1].toFixed(2),p95:+v[Math.floor(v.length*.95)].toFixed(2),max:+v.at(-1).toFixed(2)}:null;};
    // Each client's deviation from the median of the other clients' views, to name an outlier.
    const dev=tracks.map(()=>[]);
    for(let t=t0;t<t1;t+=50)for(let id=0;id<states[0].cycles;id++){
     const views=tracks.map((k,c)=>({c,p:at(k,t,id)})).filter(v=>v.p&&states[v.c].seat!==id);if(views.length<3)continue;
     for(const v of views){const o=views.filter(w=>w!==v);const mx=o.map(w=>w.p[0]).sort((a,b)=>a-b)[o.length>>1],mz=o.map(w=>w.p[1]).sort((a,b)=>a-b)[o.length>>1];dev[v.c].push({t:t-t0,id,d:Math.hypot(v.p[0]-mx,v.p[1]-mz)});}
    }
    writeFileSync(`${out}/tracks-round${round}.json`,JSON.stringify({tracks,seats:states.map(s=>s.seat)}));
    console.log('  per-client median deviation',dev.map(v=>{const d=v.map(x=>x.d).sort((a,b)=>a-b);return d.length?+d[d.length>>1].toFixed(2)+'/max '+d.at(-1).toFixed(2):'-';}).join(', '));
    const r=stat(remote),o=stat(own);
    console.log(`  frames/s ${fps.join(',')}; remote view spread (cells) ${JSON.stringify(r)}; own vs others' view ${JSON.stringify(o)}`);
    if(r&&r.p95>1)note('clients disagree on remote cycle positions',{round,...r});
   }
  }
  if(t-lastRoundChange>60e3&&states.some(s=>s.staging))note('camera staging stuck',{round,states:states.map(s=>({seat:s.seat,staging:s.staging}))});
  // When every human is down, someone asks for the next match.
  if(states.every(s=>s.round===round&&s.phase==='racing'&&!s.alive.includes(s.seat))&&states.some(s=>s.canRestart)){
   const p=pages[states.findIndex(s=>s.canRestart)];await p.keyboard.press('Enter');
  }
  if(states.every(s=>s.phase==='racing'&&!s.staging)&&shots<seenRounds.size*1&&shots<rounds){shots++;await Promise.all(pages.map(p=>p.screenshot({path:`${out}/round${round}-client${p.index}.png`})));}
  if(seenRounds.size>rounds)break;
 }
 writeFileSync(`${out}/log.json`,JSON.stringify(log));
 console.log(`${humans} humans, rounds seen ${[...seenRounds].join(',')}; ${problems.length} problem kinds`);
 assert(seenRounds.size>1,'rounds advanced');
 assert.deepEqual(problems.map(p=>p.kind),[]);
}finally{await browser.close();}
