export const MCP_SPEECH_CHUNKS={maxCharacters:120,maxWords:16};

export function speechChunks(text){
 const normalized=text.trim().replace(/\s+/g,' ');
 if(!normalized)return [];
 const sentences=typeof Intl.Segmenter==='function'
  ? [...new Intl.Segmenter('en',{granularity:'sentence'}).segment(normalized)].map(s=>s.segment.trim())
  : normalized.match(/[^.!?]+(?:[.!?]+["'”’]?|$)/g)||[normalized];
 const chunks=[];
 for(const sentence of sentences){
  let words=[];
  for(const word of sentence.split(/\s+/)){
   if(words.length&&(words.length>=MCP_SPEECH_CHUNKS.maxWords||[...words,word].join(' ').length>MCP_SPEECH_CHUNKS.maxCharacters)){
    chunks.push(words.join(' '));words=[];
   }
   words.push(word);
  }
  if(words.length)chunks.push(words.join(' '));
 }
 return chunks;
}

// One inference at a time, with at most one sentence buffered ahead of playback.
// Settle speculative errors immediately; surface them after current playback.
export async function speakSentences({text,generate,play,isCurrent,onWaiting=()=>{}}){
 const chunks=speechChunks(text);
 const prepare=chunk=>Promise.resolve().then(()=>generate(chunk)).then(audio=>({audio}),error=>({error}));
 let pending;
 try{
  if(!chunks.length||!isCurrent())return;
  pending=prepare(chunks[0]);
  for(let i=0;i<chunks.length;i++){
   if(!isCurrent())return;
   onWaiting();const result=await pending;pending=null;
   if(!isCurrent())return;
   if(result.error)throw result.error;
   if(i+1<chunks.length)pending=prepare(chunks[i+1]);
   await play(result.audio);
  }
 }finally{
  // Escape stops playback immediately. Let any already-running inference settle
  // silently before unlocking input, keeping the loaded model reusable.
  if(pending)await pending;
 }
}
