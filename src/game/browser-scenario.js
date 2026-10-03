import { createScenario } from '../levels/scenario.js';
export function browserScenario(location, random = Math.random) {
  const query = new URLSearchParams(location.search),
    reference = location.pathname.endsWith('/reference.html');
  const layout = ['authored', 'blueprint'].includes(query.get('maze'))
    ? query.get('maze')
    : reference
      ? 'authored'
      : 'blueprint';
  const seed = query.get('layoutSeed');
  return createScenario({
    layout,
    layoutSeed: seed === null ? Math.floor(random() * 4294967296) : Number(seed),
    runSeed: Number(query.get('runSeed') ?? 1982),
    siteCount: reference ? 1 : 4,
    outerMazes: query.get('outerMazes') === '1',
    centralLabyrinth: !reference&&layout==='blueprint',
  });
}

// New CLU games vary patrol starts; explicit seeds keep reference runs reproducible.
export function browserRunSeed(location,random=Math.random){
 const explicit=new URLSearchParams(location.search).get('runSeed');
 if(explicit!==null)return Number(explicit)>>>0;
 if(location.pathname.endsWith('/reference.html'))return 1982;
 return Math.floor(random()*4294967296)>>>0;
}
