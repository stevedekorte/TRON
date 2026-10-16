// Both adapters consume the same generator, preserving seeded simulation order.
export function finishStartup(work){
 let result;do{result=work.next();}while(!result.done);return result.value;
}
export async function finishStartupAsync(work,yieldControl,{sliceMilliseconds=8}={}){
 await yieldControl();
 let deadline=performance.now()+sliceMilliseconds;
 for(;;){
  const result=work.next();if(result.done)return result.value;
  if(performance.now()>=deadline){await yieldControl();deadline=performance.now()+sliceMilliseconds;}
 }
}
