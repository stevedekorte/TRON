// Production only: development reloads should never use an offline app cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  let registration,activating=false;
  const applyAtHome=()=>{
    if(!registration?.waiting||activating||!document.body.classList.contains('terminal')||document.body.classList.contains('entering')||document.body.classList.contains('detached')||document.body.classList.contains('victory'))return;
    activating=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
  };
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(activating)location.reload();});
  const register=async()=>{
    try{
      registration=await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,{scope:import.meta.env.BASE_URL,updateViaCache:'none'});
      applyAtHome();
      registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',applyAtHome));
      new MutationObserver(applyAtHome).observe(document.body,{attributes:true,attributeFilter:['class']});
      void registration.update().catch(()=>{});
    }catch(error){console.warn('Offline installation unavailable:',error);}
  };
  if(document.readyState==='complete')void register();
  else window.addEventListener('load',register,{once:true});
}
