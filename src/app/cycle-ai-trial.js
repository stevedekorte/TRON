import {validatePolicy} from '../../shared/simulation/cycle-ai/config.js';
// Loaded only by the development-only trial URL. Production never reads training artifacts.
export async function applyCycleAITrial(race){
 const response=await fetch('/test-results/cycle-ai-trained.json',{cache:'no-store'});
 if(!response.ok)throw new Error('Cycle AI trial artifact is unavailable');
 const artifact=await response.json();
 if(!artifact.timing?.passes)throw new Error('Cycle AI trial has not passed its runtime check');
 race.aiPolicy=validatePolicy(artifact.policy);race.aiMode='bounded';
 return race.aiPolicy;
}
