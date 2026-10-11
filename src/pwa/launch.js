// Production only: record a start of the installed app by loading pwa-start.html,
// whose analytics beacon counts it as a view of that path. Once per launch, so
// the reload after a service worker update isn't counted again.
if (import.meta.env.PROD) {
  const installed=['standalone','fullscreen','minimal-ui'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches)||navigator.standalone===true;
  let counted=false;
  try{counted=sessionStorage.getItem('tron-pwa-start')==='1';sessionStorage.setItem('tron-pwa-start','1');}catch{}
  if(installed&&!counted){
    const frame=document.createElement('iframe');
    frame.src=`${import.meta.env.BASE_URL}pwa-start.html`;
    frame.hidden=true;frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');
    const add=()=>document.body.append(frame);
    if(document.body)add();else addEventListener('DOMContentLoaded',add,{once:true});
  }
}
