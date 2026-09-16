export function musicCategory(path){
 const name=decodeURIComponent(path).split('/').pop().toLowerCase();
 if(/\b(recognized|recongized)\b/.test(name))return 'recognized';
 if(/\bpursued\b/.test(name))return 'pursued';
 if(/\bgotcha\b/.test(name))return 'gotcha';
 return null;
}
export function selectMusic(clips,category,current,random=Math.random){
 const matches=clips.filter(c=>c.category===category),alternatives=matches.filter(c=>c.url!==current);
 const pool=alternatives.length?alternatives:matches;
 return pool.length?pool[Math.floor(random()*pool.length)].url:null;
}
export function activelyPursued(run){
 return !run.crushed&&[...run.recognizers,...(run.enemyTanks||[])].some(e=>!e.targetGone&&['pursue','fold','drop'].includes(e.state));
}

export const MUSIC_CUES=Object.freeze({closeDistance:100,releaseDistance:140,fadeOut:.45,fadeIn:.3,quietFade:3});
export function closeRecognizer(run,wasClose){
 if(run.crushed)return false;
 const distance=wasClose?MUSIC_CUES.releaseDistance:MUSIC_CUES.closeDistance;
 return run.recognizers.some(e=>!e.targetGone&&['pursue','fold','drop'].includes(e.state)&&Math.hypot(e.x-run.x,e.s-run.s,e.y-2.8)<distance);
}
