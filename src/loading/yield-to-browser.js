// Promise continuations alone run before paint. Resume in a task after the next
// animation frame, with a fallback so background tabs can still finish loading.
export function yieldToBrowser(){
 if(typeof requestAnimationFrame!=='function'||typeof document!=='undefined'&&document.hidden)
  return new Promise(resolve=>setTimeout(resolve,0));
 return new Promise(resolve=>{
  let frame;const finish=()=>{clearTimeout(fallback);cancelAnimationFrame(frame);resolve();};
  const fallback=setTimeout(finish,100);
  frame=requestAnimationFrame(()=>setTimeout(finish,0));
 });
}
