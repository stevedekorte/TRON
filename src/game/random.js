// A fresh seed per run, with explicit seeds for reproducible diagnostics.
export function randomSeed(){return Math.floor(Math.random()*4294967296);}
export function seededRandom(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
