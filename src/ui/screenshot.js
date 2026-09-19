let statusTimer;
function screenshotStatus(message){
 let status=document.getElementById('screenshot-status');
 if(!status){status=document.createElement('div');status.id='screenshot-status';status.setAttribute('role','status');document.body.append(status);}
 clearTimeout(statusTimer);status.textContent=message;status.hidden=false;
 statusTimer=setTimeout(()=>{status.hidden=true;},4000);
}
// Capture immediately after rendering, before WebGL clears the drawing buffer.
// DOM overlays are intentionally absent from the exported image.
export async function saveScreenshot(view,canvas){
 if(document.body.classList.contains('taking-screenshot'))return;
 document.body.classList.add('taking-screenshot');
 screenshotStatus('SAVING SCREENSHOT…');
 const filename=`Space-Paranoids-${new Date().toISOString().replace(/[:.]/g,'-')}.png`;
 try{
  view.composer.render(0);
  const image=new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  // Invoke the picker before yielding, while the key event grants activation.
  const destination=window.showSaveFilePicker?window.showSaveFilePicker({suggestedName:filename,types:[{description:'PNG image',accept:{'image/png':['.png']}}]}):null;
  const handle=destination?await destination:null;
  const blob=await image;if(!blob)throw new Error('Could not capture the game image.');
  if(handle){const stream=await handle.createWritable();await stream.write(blob);await stream.close();screenshotStatus('SCREENSHOT SAVED');}
  else{
   const url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();screenshotStatus('SCREENSHOT READY — CHECK YOUR DOWNLOADS');
   setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
 }catch(error){
  if(error.name==='AbortError')screenshotStatus('SCREENSHOT CANCELLED');
  else{screenshotStatus('SCREENSHOT COULD NOT BE SAVED');console.error('Screenshot failed:',error);window.alert('Could not save the screenshot. Please try again.');}
 }finally{document.body.classList.remove('taking-screenshot');}
}
