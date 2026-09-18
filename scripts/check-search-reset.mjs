import {device} from './local-env.mjs';
import {MobileDevice} from '../lib/mobile-device.js';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
const adb=join(process.env.ANDROID_HOME,'platform-tools','adb.exe');
const shell=(...a)=>execFileSync(adb,['-s',process.env.ANDROID_SERIAL,'shell',...a],{encoding:'utf8',windowsHide:true});
shell('am','force-stop','com.android.settings');shell('am','start','-W','-n','com.android.settings/.Settings','-f','0x10008000');
const d=new MobileDevice(device);
let ui=await d.getElementsOnScreen();const e=ui.find(e=>e.text==='Search settings'||e.label==='Search settings');
await d.tap(e.rect.x+e.rect.width/2,e.rect.y+e.rect.height/2);
for(let i=0;i<4;i++){
 await new Promise(r=>setTimeout(r,2000));
 ui=await d.getDetailedElementsOnScreen();
 console.log(JSON.stringify({iteration:i,input:ui.filter(e=>/EditText/.test(e.type)),labels:ui.map(e=>e.label).slice(0,8)}));
}
