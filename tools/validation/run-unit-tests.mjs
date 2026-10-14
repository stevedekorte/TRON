import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const files=(await readdir('tests/unit')).filter(name=>name.endsWith('.test.js')).sort().map(name=>'tests/unit/'+name);
const result=spawnSync(process.execPath,['--test',...files,...process.argv.slice(2)],{stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
