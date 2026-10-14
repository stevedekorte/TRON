import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {checkBoundaries} from '../../tools/validation/check-boundaries.mjs';
test('multiplayer authority stays within browser-free shared modules',async()=>{
 const result=await checkBoundaries();assert(result.modules>=14);
});
test('asset aliases resolve without pointing outside controlled asset directories',async()=>{
 const paths=JSON.parse(await readFile('assets/path-map.json','utf8'));
 for(const [old,current] of Object.entries(paths)){
  assert.match(old,/^(public|docs)\//);assert.match(current,/^(public\/assets|assets\/(runtime|source)|references)\//);
  assert(!current.split('/').includes('..'));assert((await stat(current)).isFile(),current);
 }
});
