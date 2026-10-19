// Release the main thread between bounded CPU slices without requiring a full
// display frame for every slice. Unlike Promise.resolve(), these yield to input
// and rendering tasks. Older browsers use the ordinary task queue.
export function yieldStartup(){
 if(globalThis.scheduler?.yield)return globalThis.scheduler.yield();
 return new Promise(resolve=>setTimeout(resolve,0));
}
