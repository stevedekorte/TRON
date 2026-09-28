import { cp, mkdir } from 'node:fs/promises';

// Include the readable docs with the static game build without shipping a Git checkout.
await mkdir('dist/docs/colvmn/layout', { recursive: true });
for (const name of ['credits_extended.txt','index.html','_index.md','llms.txt','llms-full.txt','sitemap.xml','references','assets','sounds','validation','jev','history']) {
  await cp(`docs/${name}`, `dist/docs/${name}`, { recursive: true, filter: source => !source.split('/').some(part=>part==='videos'||part==='music') });
}
await mkdir('dist/docs/models', { recursive: true });
for (const name of ['_index.md','index.html']) await cp('docs/models/'+name,'dist/docs/models/'+name);
await cp('docs/models/carrier-shuttle','dist/docs/models/carrier-shuttle',{recursive:true});
await cp('docs/colvmn/style.css','dist/docs/colvmn/style.css');
await cp('docs/colvmn/layout/bundle.js','dist/docs/colvmn/layout/bundle.js');
await cp('docs/colvmn/LICENSE','dist/docs/colvmn/LICENSE');
await cp('node_modules/three/LICENSE','dist/THREE-LICENSE.txt');
await cp('Goal.md','dist/Goal.md');
await cp('AGENTS.md','dist/AGENTS.md');
console.log('Copied project documentation into dist/docs.');
