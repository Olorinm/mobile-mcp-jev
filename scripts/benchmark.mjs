import { root, device } from './local-env.mjs';
import { config, opencode, runtimeEnvironment } from './opencode-config.mjs';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MobileDevice } from '../lib/mobile-device.js';
import { Mobilecli } from '../lib/mobilecli.js';
import { searchWasExecuted } from './benchmark-verification.mjs';

const adb = join(process.env.ANDROID_HOME,'platform-tools','adb.exe');
const serial = process.env.ANDROID_SERIAL || 'emulator-5554';
const shell = (...args) => execFileSync(adb,['-s',serial,'shell',...args],{encoding:'utf8',windowsHide:true,timeout:30000}).trim();
const robot = new MobileDevice(device);
if(new Mobilecli().getDevices({platform:'android'}).data.devices.find(d=>d.id===device)?.type!=='emulator') throw new Error('The destructive reset benchmark is restricted to a test Android emulator');
const tasks = [
  {id:'dark-theme',goal:'Open Display settings and enable Dark theme.',reset:()=>shell('cmd','uimode','night','no'),verify:()=>({success:shell('cmd','uimode','night')==='Night mode: yes',evidence:shell('cmd','uimode','night')})},
  {id:'screen-timeout',goal:'Set the screen timeout to 30 seconds in Display settings.',reset:()=>shell('settings','put','system','screen_off_timeout','600000'),verify:()=>({success:shell('settings','get','system','screen_off_timeout')==='30000',evidence:'screen_off_timeout='+shell('settings','get','system','screen_off_timeout')})},
  {id:'settings-search',goal:'Use the search box in Settings to search for "Battery saver", then open the Battery Saver settings page. Do not enable Battery Saver.',reset:()=>{},verify:async()=>{
    const dump=shell('dumpsys','activity','top');
    const active=dump.split(/\n(?=  ACTIVITY )/).find(s=>s.startsWith('  ACTIVITY com.android.settings/')&&s.includes('mResumed=true'))||'';
    const power=shell('settings','get','global','low_power');
    const visible=active.includes('BatterySaverSettings{') && power==='0';
    return {success:visible,evidence:{resumedSettings:!!active,batterySaverFragment:active.includes('BatterySaverSettings{'),lowPower:power}};
  }},
];
const chosen = process.env.BENCH_TASK ? tasks.filter(t=>t.id===process.env.BENCH_TASK) : tasks;
const repetitions = Number(process.env.BENCH_REPETITIONS || 3);
const modes = process.env.BENCH_MODE ? [process.env.BENCH_MODE] : ['baseline','hybrid'];
const directory = process.env.BENCH_RESUME_DIR || join(root,'benchmark-results',`opencode-${new Date().toISOString().replace(/[:.]/g,'-')}`);
mkdirSync(directory,{recursive:true});
const cwd=join(root,'.local/opencode-work');mkdirSync(cwd,{recursive:true});
const rows=process.env.BENCH_RESUME_DIR ? JSON.parse(readFileSync(join(directory,'results.json'),'utf8')) : [];
if(rows.some(r => r.model !== config('baseline').model)) throw new Error('Cannot resume results from a different or historical model; use a new run directory');

async function run(mode,task,repeat) {
  shell('input','keyevent','WAKEUP'); shell('wm','dismiss-keyguard');
  shell('settings','put','global','stay_on_while_plugged_in','3');
  shell('cmd','uimode','night','no');
  shell('settings','put','system','screen_off_timeout','600000');
  shell('am','force-stop','com.google.android.settings.intelligence');
  if(task.id==='settings-search') shell('pm','clear','com.google.android.settings.intelligence');
  shell('am','force-stop','com.android.settings');task.reset();
  shell('am','start','-W','-n','com.android.settings/.Settings','-f','0x10008000');
  if(task.id==='settings-search') {
    // This dedicated search application's history is reset above on the test
    // emulator. Warm its index and verify an empty query before returning home.
    let ui=await robot.getElementsOnScreen();
    const search=ui.find(e=>e.text==='Search settings'||e.label==='Search settings');
    if(!search) throw new Error('Cannot prepare empty Settings search');
    await robot.tap(search.rect.x+search.rect.width/2,search.rect.y+search.rect.height/2);
    await new Promise(resolve=>setTimeout(resolve,2000));
    ui=await robot.getElementsOnScreen();
    await new Promise(resolve=>setTimeout(resolve,500));
    ui=await robot.getElementsOnScreen();
    const input=ui.find(e=>/EditText/.test(e.type));
    if(!input || (input.text && input.text!=='Search settings')) throw new Error('Search query was not cleared');
    await robot.pressButton('BACK');await robot.pressButton('BACK');
    shell('am','force-stop','com.google.android.settings.intelligence');
    shell('am','force-stop','com.android.settings');
    shell('am','start','-W','-n','com.android.settings/.Settings','-f','0x10008000');
  }
  // Warm the device observation connection identically; reset/verification are
  // outside timing and never shown to either policy.
  const initialElements=await robot.getElementsOnScreen();
  const initialText=JSON.stringify(initialElements);
  if(!initialText.includes('Search settings')||!initialText.includes('Network &')) throw new Error('Reset did not reach Settings home; no scored run was started');
  const initial=await robot.getScreenshot({maxSize:720});
  const stem=`${repeat}-${task.id}-${mode}-${Date.now()}`;
  writeFileSync(join(directory,stem+'-before.png'),initial);
  const c=config(mode);
  const prompt=`Android device: ${device}. The Settings app is already open at its home page. Task: ${task.goal}\n${mode==='jev'?'Call mobile_jev_run once with this exact goal, maxSteps=16, timeoutMs=120000. Report the returned status; do not retry the run.':mode==='hybrid'?'Start by calling mobile_jev_run with this goal, maxSteps=16, timeoutMs=120000 and any literal input strings already in the goal. Inspect its finalScreen; if the full task is not complete, finish it with ordinary Mobile MCP tools. Verify the destination page and requested state. Keep total device actions within 16.':'Use the Mobile MCP GUI tools to complete this task. Observe after navigation. Do not use shell, scripts, deep links, or make unrelated changes. Stop within 16 device actions.'}`;
  const events=[]; let stdout='',stderr=''; let timedOut=false;
  const start=performance.now();
  const child=spawn(opencode,['run','--format','json','--agent','mobile','--title',`Mobile benchmark ${stem}`,prompt],{
    cwd,windowsHide:true,stdio:['ignore','pipe','pipe'],
    env:{...process.env,...runtimeEnvironment,OPENCODE_DISABLE_MODELS_FETCH:'1',OPENCODE_DISABLE_DEFAULT_PLUGINS:'1',OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER:'1',OPENCODE_CONFIG_CONTENT:JSON.stringify(c)}
  });
  child.stdout.on('data',d=>{stdout+=d;appendFileSync(join(directory,stem+'.live.jsonl'),d);});child.stderr.on('data',d=>{stderr+=d;});
  const timeout=setTimeout(()=>{timedOut=true;execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});},180000);
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
  clearTimeout(timeout);
  const elapsedMs=performance.now()-start;
  for(const line of stdout.split(/\r?\n/)){try{events.push(JSON.parse(line));}catch{}}
  writeFileSync(join(directory,stem+'.jsonl'),stdout);
  writeFileSync(join(directory,stem+'.stderr.log'),stderr.replace(/vck_[A-Za-z0-9]+/g,'[REDACTED]'));
  const finished=events.filter(e=>e.type==='step_finish');
  const toolEvents=events.filter(e=>e.type==='tool_use');
  let jev;
  const jevRuns=[];
  for(const e of toolEvents){if(e.part?.tool?.endsWith('mobile_jev_run')){try{jevRuns.push(JSON.parse(e.part.state.output));}catch{}}}
  if(jevRuns.length) jev={...jevRuns.at(-1),calls:jevRuns.flatMap(r=>r.calls),trace:jevRuns.flatMap(r=>r.trace),usage:{inputTokens:jevRuns.reduce((n,r)=>n+r.usage.inputTokens,0),outputTokens:jevRuns.reduce((n,r)=>n+r.usage.outputTokens,0),knownCostUsd:jevRuns.reduce((n,r)=>n+r.usage.knownCostUsd,0),completeAccounting:jevRuns.every(r=>r.usage.completeAccounting)}};
  const outer={calls:finished.length,inputTokens:0,outputTokens:0,reasoningTokens:0,cacheReadTokens:0,costUsd:0};
  for(const e of finished){const t=e.part.tokens;outer.inputTokens+=t.input??0;outer.outputTokens+=t.output??0;outer.reasoningTokens+=t.reasoning??0;outer.cacheReadTokens+=t.cache?.read??0;outer.costUsd+=e.part.cost??0;}
  outer.completeAccounting=finished.length>0 && !timedOut && code===0 && !events.some(e=>e.type==='error') && finished.every(e=>Number.isFinite(e.part.cost)&&e.part.tokens);
  // Save measurements BEFORE verification so an independent checker failure
  // cannot silently erase an executed attempt.
  writeFileSync(join(directory,stem+'-pending.json'),JSON.stringify({elapsedMs,outer,jev,code,timedOut},null,2));
  let verification;
  try { verification=await task.verify(); } catch(e) { verification={success:false,error:e.name}; }
  if(task.id==='settings-search') {
    const usedSearch=searchWasExecuted(mode,events,jev);
    verification.usedSearch=!!usedSearch;verification.success=verification.success&&!!usedSearch;
  }
  writeFileSync(join(directory,stem+'-after.png'),await robot.getScreenshot({maxSize:720}));
  const row={task:task.id,goal:task.goal,mode,repeat,artifactStem:stem,exitCode:code,timedOut,elapsedMs,verification,outer,jev,jevRuns,
    model:c.model, modelPricing:c.provider['mobile-gateway'].models['deepseek/deepseek-v4.1-flash'].cost,
    totalCostUsd:outer.costUsd+(jev?.usage?.knownCostUsd??0),
    tokenAccounting:'OpenCode output excludes its separately reported reasoning; both are included in OpenCode cost. Jev counts are from Gateway.',
    tools:toolEvents.map(e=>({tool:e.part.tool,input:e.part.state?.input,status:e.part.state?.status,time:e.part.state?.time})),
    errors:events.filter(e=>e.type==='error'),finalText:events.filter(e=>e.type==='text').map(e=>e.part.text).join('\n')};
  writeFileSync(join(directory,stem+'.json'),JSON.stringify(row,null,2));
  rows.push(row);writeFileSync(join(directory,'results.json'),JSON.stringify(rows,null,2));
  console.log(JSON.stringify({task:task.id,mode,repeat,success:verification.success,seconds:elapsedMs/1000,costUsd:row.totalCostUsd,outerCalls:outer.calls,jevStatus:jev?.status,tools:row.tools.length,errors:row.errors,path:directory}));
}

try {
  for(let repeat=0;repeat<repetitions;repeat++) for(const task of chosen) for(const mode of (repeat%2?[...modes].reverse():modes)) {
    if(!rows.some(r=>r.task===task.id&&r.mode===mode&&r.repeat===repeat)) await run(mode,task,repeat);
  }
} catch(e) {console.error(`${e.name}: ${String(e.message).replace(/vck_[A-Za-z0-9]+/g,'[REDACTED]').slice(0,500)}`);process.exitCode=1;}
