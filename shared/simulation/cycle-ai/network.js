// Optional residual scorer. Fixed 32 -> 16 ReLU -> 1; no inference dependency.
// Safety masks and candidate generation always remain outside the network.
export const NETWORK_SHAPE=Object.freeze({inputs:32,hidden:16,weights:545,version:1});
export function validateNetwork(network){
 if(network?.version!==1||network.weights?.length!==545)throw new Error('Invalid cycle neural scorer');
 const weights=Float32Array.from(network.weights);
 if(weights.some(x=>!Number.isFinite(x)||Math.abs(x)>4))throw new Error('Invalid cycle neural weights');
 return {version:1,weights};
}
export function neuralScore(network,features){
 if(!network)return 0;const w=network.weights;let output=w[544];
 for(let h=0;h<16;h++){
  let value=w[512+h];for(let i=0;i<32;i++)value+=w[h*32+i]*features[i];
  output+=Math.max(0,value)*w[528+h];
 }
 return Number.isFinite(output)?Math.max(-.25,Math.min(.25,output)):0;
}
export function candidateFeatures(b,c,target,out){
 out.fill(0);out[0]=Math.min(1,c.clearance/45);out[1]=c.space;out[2]=Math.min(1,c.exit/10);out[3]=c.cutoff;
 out[4]=c.pressure;out[5]=Math.min(1,c.ally);out[6]=c.spent;out[7]=c.pedal;out[8]=c.dir===b.dir?1:0;
 out[9]=(b.speedMultiplier??1)/2.5;out[10]=b.turboCharge??1;out[11]=b.brakeCharge??1;out[12]=c.speed/2.5;
 out[13]=Math.min(1,c.distance/100);out[14]=c.safe?1:0;out[15]=1;
 out[16+b.dir]=1;out[20+c.dir]=1;
 if(target){out[24]=Math.max(-1,Math.min(1,(target.x-b.x)/40));out[25]=Math.max(-1,Math.min(1,(target.z-b.z)/40));out[26]=(target.speedMultiplier??1)/2.5;out[27]=target.turboCharge??1;out[28+target.dir]=1;}
 return out;
}
