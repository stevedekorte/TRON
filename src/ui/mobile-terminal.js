export function isMobileTerminal(device=navigator){
 if(device===navigator&&typeof window.tronMobileTerminal==='boolean')return window.tronMobileTerminal;
 return device.userAgentData?.mobile===true||/Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(device.userAgent)||(/Macintosh|MacIntel/i.test(`${device.userAgent} ${device.platform}`)&&device.maxTouchPoints>1);
}
