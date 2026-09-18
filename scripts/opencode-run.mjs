import { root, device } from './local-env.mjs';
import { config, opencode } from './opencode-config.mjs';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const [mode='jev',...words]=process.argv.slice(2);
if (!['baseline','jev'].includes(mode)) throw new Error('First argument must be baseline or jev');
const cwd=join(root,'.local/opencode-work');mkdirSync(cwd,{recursive:true});
const goal=words.join(' ') || 'Enable Dark theme in Android Display settings.';
const c=config(mode==='jev'?'hybrid':mode);
// Interactive runs may open the app; benchmark setup opens it before the clock.
if(mode==='jev') {
  c.agent.mobile.tools.mobile_mobile_launch_app=true;
  c.permission.mobile_mobile_launch_app='allow';
}
const prompt=`Android device: ${device}. Task: ${goal}. ${mode==='jev'?'Open the appropriate starting app using mobile_launch_app if necessary, then use mobile_jev_run. Check its final screen against the goal and finish any remaining work with ordinary tools.':''}`;
const child=spawn(opencode,['run','--format','default','--agent','mobile','--title','Mobile task',prompt],{cwd,windowsHide:true,stdio:['ignore','inherit','inherit'],env:{...process.env,OPENCODE_DISABLE_MODELS_FETCH:'1',OPENCODE_DISABLE_DEFAULT_PLUGINS:'1',OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER:'1',OPENCODE_CONFIG_CONTENT:JSON.stringify(c)}});
child.on('error',e=>{console.error(e.message);process.exitCode=1;});child.on('close',code=>{process.exitCode=code??1;});
