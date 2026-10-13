export const MCP_SPEECH={endpoint:'https://fal.run/fal-ai/chatterbox/text-to-speech/turbo',reference:'https://dekorte.com/fun/TRON/audio/mcp-reference.wav',temperature:.7,timeoutMs:90000,maxCharacters:1000};
export function speechText(body){
 if(typeof body?.text!=='string'||!body.text.trim()||body.text.length>MCP_SPEECH.maxCharacters)throw Error('Invalid speech text');
 return body.text.trim();
}
export async function mcpSpeech({text,key,signal,fetchImpl=fetch}){
 const response=await fetchImpl(MCP_SPEECH.endpoint,{method:'POST',headers:{Authorization:`Key ${key}`,'Content-Type':'application/json'},body:JSON.stringify({text,audio_url:MCP_SPEECH.reference,temperature:MCP_SPEECH.temperature}),signal});
 if(!response.ok)throw Error('MCP VOICE SERVICE UNAVAILABLE');
 const data=await response.json(),url=new URL(data.audio?.url);
 if(url.protocol!=='https:'||!(url.hostname==='fal.media'||url.hostname.endsWith('.fal.media')))throw Error('Invalid speech audio');
 return {audioUrl:url.href};
}
