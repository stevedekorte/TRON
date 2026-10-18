import {markPlay} from './mark-play.js';
let counted=false;
// Called after microphone permission succeeds and BIT actually begins.
export function markBitPlay(){if(!counted){counted=true;markPlay('bit',new URL('../',location.href));}}
