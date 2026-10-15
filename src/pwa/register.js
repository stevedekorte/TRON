// Production only: development reloads should never use an offline app cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const register=async()=>{
    try{
      const registration=await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,{scope:import.meta.env.BASE_URL,updateViaCache:'none'});
      // Download updates in the background, but let the waiting worker activate
      // after existing tabs close. Reaching the menu must never restart startup
      // or interrupt a program selection. update.html remains an explicit override.
      void registration.update().catch(()=>{});
    }catch(error){console.warn('Offline installation unavailable:',error);}
  };
  if(document.readyState==='complete')void register();
  else window.addEventListener('load',register,{once:true});
}
