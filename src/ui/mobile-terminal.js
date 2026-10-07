export function isMobileTerminal(device=navigator){
 return device.userAgentData?.mobile===true||/Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(device.userAgent)||(/Macintosh|MacIntel/i.test(`${device.userAgent} ${device.platform}`)&&device.maxTouchPoints>1);
}

export function showMobileTerminal(){
 document.body.classList.add('mobile-terminal');
 const copy=document.querySelector('#loading .terminal-copy');
 copy.textContent='MOBILE TERMINALS NOT SUPPORTED';
 const cursor=document.createElement('span');cursor.className='terminal-cursor';cursor.setAttribute('aria-hidden','true');copy.append(cursor);
}
