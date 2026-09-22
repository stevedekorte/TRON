import {existsSync,readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {JEV_INPUT_USD_PER_MILLION} from '../shared/jev-pricing.js';
export {JEV_INPUT_USD_PER_MILLION};
const HOUR_MS=3600000;
// Reserve before sending; unknown outcomes retain the conservative reservation.
export class JevSpend{
 constructor({limitUsd=1,price=JEV_INPUT_USD_PER_MILLION,clock=Date.now,path=null}={}){
  Object.assign(this,{limitUsd,price,clock,path});
  this.entries=path&&existsSync(path)?JSON.parse(readFileSync(path,'utf8')):[];
  if(!Array.isArray(this.entries)||this.entries.some(e=>!Number.isFinite(e.at)||!Number.isFinite(e.usd)||e.usd<0))throw new Error('Invalid JEV spend ledger');
 }
 prune(){this.entries=this.entries.filter(e=>e.at>this.clock()-HOUR_MS);}
 save(){if(this.path){mkdirSync(dirname(this.path),{recursive:true});writeFileSync(this.path+'.tmp',JSON.stringify(this.entries));renameSync(this.path+'.tmp',this.path);}}
 status(){this.prune();const spentUsd=this.entries.reduce((sum,e)=>sum+e.usd,0);return {limitUsd:this.limitUsd,spentUsd,remainingUsd:Math.max(0,this.limitUsd-spentUsd),inputUsdPerMillion:this.price,windowSeconds:3600};}
 reserve(payload){
  const usd=(Buffer.byteLength(JSON.stringify(payload),'utf8')*2+4096)*this.price/1e6;
  const status=this.status();
  if(usd>status.remainingUsd)return {retryAfter:this.entries.length?Math.max(1,Math.ceil((this.entries[0].at+HOUR_MS-this.clock())/1000)):3600};
  const entry={at:this.clock(),usd};this.entries.push(entry);this.save();return {entry};
 }
 settle(entry,usage){if(Number.isSafeInteger(usage?.input_tokens)&&usage.input_tokens>=0){entry.usd=usage.input_tokens*this.price/1e6;this.save();}}
}
