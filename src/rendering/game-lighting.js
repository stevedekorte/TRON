import {Group,HemisphereLight,DirectionalLight,ACESFilmicToneMapping} from 'three';
export const GAME_LIGHTING=Object.freeze({toneMapping:ACESFilmicToneMapping,exposure:1.24});
export function createGameLights(){
 const lights=new Group();
 lights.add(new HemisphereLight(0xaac8ff,0x251829,2));
 const key=new DirectionalLight(0xc4d9ff,2.4);key.position.set(-35,70,-35);lights.add(key);
 const fill=new DirectionalLight(0x7b72ab,.9);fill.position.set(50,15,-40);lights.add(fill);
 return lights;
}
