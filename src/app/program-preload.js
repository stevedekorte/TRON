// Warm BIT's separate document and dependencies without executing it, requesting
// microphone access, or calling JEV. Its own page still creates its audio context.
export async function preloadBitResources(){
 const base=new URL(`${import.meta.env.BASE_URL}bit/`,location.origin);
 const page=await fetch(new URL('index.html',base),{cache:'force-cache'});
 if(!page.ok)throw Error(`BIT terminal: HTTP ${page.status}`);
 const document=new DOMParser().parseFromString(await page.text(),'text/html');
 const paths=[...document.querySelectorAll('script[src],img[src]')].map(e=>e.getAttribute('src'));
 paths.push('../fonts/VT323-Regular.ttf',...['bit_idle_1','bit_idle_2','bit_yes','bit_no'].map(n=>`resources/entities/Bit/models/${n}.obj`),...['yes','no'].map(n=>`resources/entities/Bit/sounds/${n}.wav`));
 await Promise.all([...new Set(paths)].map(async path=>{
  const url=new URL(path,base);if(url.origin!==location.origin)return;
  const response=await fetch(url,{cache:'force-cache'});if(!response.ok)throw Error(`BIT resource: HTTP ${response.status}`);await response.arrayBuffer();
 }));
}
