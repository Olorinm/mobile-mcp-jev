import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { searchWasExecuted } from './benchmark-verification.mjs';
const dir=resolve(process.argv[2]);
const rows=JSON.parse(readFileSync(join(dir,'results.json'),'utf8'));
for(const r of rows.filter(r=>r.task==='settings-search')) {
  const events=readFileSync(join(dir,r.artifactStem+'.jsonl'),'utf8').trim().split(/\r?\n/).flatMap(l=>{try{return [JSON.parse(l)]}catch{return []}});
  r.verification.usedSearch=searchWasExecuted(r.mode,events,r.jev);
  const evidence=r.verification.evidence;
  r.verification.success=!!evidence?.resumedSettings&&!!evidence?.batterySaverFragment&&evidence?.lowPower==='0'&&r.verification.usedSearch;
  writeFileSync(join(dir,r.artifactStem+'.json'),JSON.stringify(r,null,2));
  console.log(JSON.stringify({task:r.task,mode:r.mode,repeat:r.repeat,verification:r.verification}));
}
writeFileSync(join(dir,'results.json'),JSON.stringify(rows,null,2));
