const messages={
 'Navigation to app startup (document, modules, initial paint)':'ENCOM HOST CONNECTION ESTABLISHED',
 'Entry document / bootstrap download':'REMOTE ACCESS CHANNEL OPEN',
 'Styles / loading terminal paint':'TERMINAL DISPLAY ONLINE',
 'Game modules download / evaluation':'PROGRAM LIBRARY RECEIVED',
 'Scenario / maze geometry':'GAME GRID MAPPED',
 'Initial simulation / enemy placement':'SECURITY PROGRAMS ASSIGNED',
 'Wait for physics initialization':'MOTION PROCESSOR READY',
 'Create WebGL2 context':'VISUAL INTERFACE ONLINE',
 'CLU/cycle audio and BIT resources':'COMMUNICATIONS AND BIT SERVICES READY',
 'Tank + Recognizer models (fetch, decode, adapt)':'TANK AND RECOGNIZER RECORDS LOADED',
 'Carrier model (fetch, decode, adapt)':'CARRIER RECORDS LOADED',
 'Create debris physics world':'MATERIAL RESPONSE SYSTEM READY',
 'Build rendering world / meshes / shadows':'GRID DISPLAY ASSEMBLED',
 'CLU opening render / shader setup':'CLU VIEWING CHANNEL CALIBRATED',
 'First render submission / shader setup':'TERMINAL IMAGE VERIFIED',
 'Opening terminal ready':'PROGRAM ACCESS GRANTED',
 'Frame callback after opening ready':'DISPLAY LINK SYNCHRONIZED',
 'Solar sailer module + model':'SOLAR SAILER RECORDS LOADED',
 'Arena module + models / cycle setup':'LIGHT CYCLE PROGRAMS LOADED',
 'Attach arena / floor':'LIGHT CYCLE GRID ASSEMBLED',
 'Arena assets ready':'LIGHT CYCLE GRID READY',
 'Start requested':'PROGRAM EXECUTION REQUESTED',
 'New game simulation reset':'PROGRAM MEMORY INITIALIZED',
 'Player entered cycle arena':'GRID TRANSFER COMPLETE',
};
export const BOOT_MINIMUM_MS=500;
const activeMessages={
 'Scenario / maze geometry':'MAPPING GAME GRID',
 'Create WebGL2 context':'OPENING VISUAL INTERFACE',
 'Create debris physics world':'STARTING MATERIAL RESPONSE SYSTEM',
 'CLU opening render / shader setup':'CALIBRATING CLU VIEWING CHANNEL',
 'First render submission / shader setup':'VERIFYING TERMINAL IMAGE',
 'Attach arena / floor':'ASSEMBLING LIGHT CYCLE GRID',
 'New game simulation reset':'INITIALIZING PROGRAM MEMORY',
 'Initial simulation / enemy placement':'ASSIGNING SECURITY PROGRAMS',
 'Wait for physics initialization':'STARTING MOTION PROCESSOR',
 'CLU/cycle audio and BIT resources':'LOADING COMMUNICATIONS AND BIT SERVICES',
 'Tank + Recognizer models (fetch, decode, adapt)':'RETRIEVING TANK AND RECOGNIZER RECORDS',
 'Carrier model (fetch, decode, adapt)':'RETRIEVING CARRIER RECORDS',
 'Build rendering world / meshes / shadows':'ASSEMBLING GRID DISPLAY',
 'Solar sailer module + model':'RETRIEVING SOLAR SAILER RECORDS',
 'Arena module + models / cycle setup':'LOADING LIGHT CYCLE PROGRAMS',
};
const pending=new Map();
let lastMessage='DIALING HOST';
function refreshStatus(){
 const status=document.getElementById('boot-status');if(!status)return;
 const label=[...pending].find(([,stage])=>performance.now()-stage.start>=BOOT_MINIMUM_MS)?.[0];
 status.textContent=label?(activeMessages[label]||`PROCESSING ${messages[label]}`):lastMessage;
}
export function beginBootStage(label){
 if(!messages[label])return;
 const stage={start:performance.now()};
 stage.timer=setTimeout(refreshStatus,BOOT_MINIMUM_MS);pending.set(label,stage);
}
export function printBootLine(label,durationMs){
 const stage=pending.get(label);if(stage){clearTimeout(stage.timer);pending.delete(label);}
 if(messages[label]&&durationMs>=BOOT_MINIMUM_MS)lastMessage=messages[label];
 refreshStatus();
}
