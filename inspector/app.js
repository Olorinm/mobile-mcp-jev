/* Original local inspector UI for mobile-mcp-jev. No third-party UI assets. */
const $ = id => document.getElementById(id);
const copy = {
  "en": {
    "executed": "actions",
    "tokens": "Token usage",
    "device": "Android device",
    "goal": "What should happen?",
    "app": "App package · optional",
    "options": "Device & options",
    "texts": "Input strings · one per line",
    "maxSteps": "Decision limit",
    "timeout": "Time limit · seconds",
    "review": "Review step",
    "runAuto": "Run automatically",
    "modeNote": "This panel follows the Jev executor. GLM only generates input text when needed; OpenCode verification is a separate mode.",
    "screenTitle": "Screen",
    "preview": "Refresh",
    "showElements": "Controls",
    "noScreen": "No screenshot",
    "noScreenHint": "Select a device in options, then refresh.",
    "snapshotHint": "Snapshot",
    "decisionTitle": "Next action",
    "step": "Execute this step",
    "resume": "Continue automatically",
    "pause": "Pause before next action",
    "stop": "Stop",
    "operations": "Action",
    "probability": "Choice probabilities",
    "targets": "Target control",
    "timelineTitle": "Actions",
    "timelineHint": "Only “Executed” actions changed the device.",
    "connected": "Connected",
    "offline": "Reconnecting",
    "idle": "Ready",
    "previewing": "Reading screen",
    "starting": "Opening app",
    "running": "Running",
    "paused": "Awaiting your step",
    "stopping": "Stopping",
    "finished": "Stopped",
    "error": "Could not continue",
    "deciding": "Jev is deciding",
    "writing": "Preparing input text",
    "acting": "Executing",
    "emptyDecision": "No decision yet",
    "emptyDecisionHint": "Start a task to see the next action.",
    "readyDecision": "PROPOSED ACTION",
    "thinking": "CURRENT PHASE",
    "waitingHint": "Waiting for execution.",
    "autoHint": "",
    "terminalHint": "Confirm the result on the device.",
    "reported_complete": "Completion claimed · unverified",
    "blocked": "Blocked",
    "step_limit": "Decision limit reached",
    "cancelled_or_timeout": "Stopped or timed out",
    "no_progress": "No progress",
    "unstable_screen": "Screen kept changing",
    "noProb": "Choices will appear after a model response.",
    "noLog": "No actions yet.",
    "executedOutcome": "Executed",
    "selected": "Awaiting execution",
    "not_executed": "Not executed",
    "attempted": "Attempted · check device",
    "discarded_stale_screen": "Discarded · screen changed",
    "claimed": "Claimed complete",
    "input": "Input",
    "calls": "model calls",
    "lastCall": "Last call",
    "unknownCost": "Some call usage is missing; the displayed cost is a lower bound.",
    "imageError": "A screenshot could not be captured. The element observations are still available.",
    "missing_key": "Add AI_GATEWAY_API_KEY to the server’s local .env file, then restart it.",
    "device_unavailable": "No online Android device is available. Check the SDK, connection and device selection.",
    "invalid_request": "Check the task, app package and run limits.",
    "busy": "A task or screen refresh is already using the device.",
    "stale_decision": "This decision is no longer pending. The current session has been refreshed.",
    "run_failed": "The run could not continue. Check the device and local model configuration.",
    "stopped": "The run was stopped.",
    "request_failed": "The local request failed. Check that the inspector server is running.",
    "noneDevices": "No online Android devices",
    "snapshotAt": "",
    "TAP": "Tap",
    "TYPE": "Type text",
    "SWIPE_UP": "Swipe up",
    "SWIPE_DOWN": "Swipe down",
    "BACK": "Back",
    "ENTER": "Enter",
    "WAIT": "Wait",
    "DONE": "Done",
    "BLOCKED": "Blocked",
    "observed": "Screen observed",
    "discarded": "Rechecking changed screen"
  },
  "zh": {
    "executed": "个动作",
    "tokens": "Token 用量",
    "device": "Android 设备",
    "goal": "希望完成什么？",
    "app": "应用包名 · 可选",
    "options": "设备与参数",
    "texts": "输入文字 · 每行一项",
    "maxSteps": "决策次数上限",
    "timeout": "时间上限 · 秒",
    "review": "查看下一步",
    "runAuto": "自动运行",
    "modeNote": "面板跟随 Jev 执行器。GLM 仅按需生成输入文字；OpenCode 验收接管是另一个入口。",
    "screenTitle": "画面",
    "preview": "刷新",
    "showElements": "控件",
    "noScreen": "暂无画面",
    "noScreenHint": "在参数中选择设备后刷新。",
    "snapshotHint": "截图",
    "decisionTitle": "下一步",
    "step": "执行这一步",
    "resume": "继续自动运行",
    "pause": "下一步执行前暂停",
    "stop": "停止",
    "operations": "动作",
    "probability": "候选概率",
    "targets": "目标控件",
    "timelineTitle": "动作记录",
    "timelineHint": "只有“已执行”才表示动作确实已发出。",
    "connected": "已连接",
    "offline": "重新连接中",
    "idle": "准备就绪",
    "previewing": "正在读取画面",
    "starting": "正在打开应用",
    "running": "运行中",
    "paused": "等待你执行",
    "stopping": "正在停止",
    "finished": "已停止",
    "error": "未能继续",
    "deciding": "Jev 正在判断",
    "writing": "正在准备输入文字",
    "acting": "正在执行",
    "emptyDecision": "还没有决策",
    "emptyDecisionHint": "开始任务后显示。",
    "readyDecision": "准备执行的动作",
    "thinking": "当前阶段",
    "waitingHint": "等待执行。",
    "autoHint": "",
    "terminalHint": "请在手机上确认结果。",
    "reported_complete": "模型声称完成 · 尚未核验",
    "blocked": "无法继续",
    "step_limit": "已达到决策次数上限",
    "cancelled_or_timeout": "已停止或超时",
    "no_progress": "没有进展",
    "unstable_screen": "界面持续变化",
    "noProb": "模型返回后，这里会显示候选选项。",
    "noLog": "暂无动作。",
    "executedOutcome": "已执行",
    "selected": "等待执行",
    "not_executed": "未执行",
    "attempted": "已尝试 · 请检查手机",
    "discarded_stale_screen": "已丢弃 · 界面变化",
    "claimed": "声称完成",
    "input": "输入",
    "calls": "次模型调用",
    "lastCall": "最近一次",
    "unknownCost": "部分调用未返回完整用量；显示的是已知费用下限。",
    "imageError": "截图暂未获取到，仍可查看已读取的控件信息。",
    "missing_key": "请在服务端本地 .env 中设置 AI_GATEWAY_API_KEY，然后重启面板。",
    "device_unavailable": "没有可用的在线 Android 设备，请检查 SDK、设备连接和选择。",
    "invalid_request": "请检查任务、应用包名和运行限制。",
    "busy": "当前设备已有任务或画面刷新正在进行。",
    "stale_decision": "这一步已不再等待执行，已刷新当前会话。",
    "run_failed": "运行未能继续，请检查设备和本地模型配置。",
    "stopped": "已停止运行。",
    "request_failed": "本地请求失败，请检查调试服务是否仍在运行。",
    "noneDevices": "没有在线 Android 设备",
    "snapshotAt": "",
    "TAP": "点击",
    "TYPE": "输入文字",
    "SWIPE_UP": "向上滑动",
    "SWIPE_DOWN": "向下滑动",
    "BACK": "返回",
    "ENTER": "回车",
    "WAIT": "等待",
    "DONE": "完成",
    "BLOCKED": "无法继续",
    "observed": "已读取界面",
    "discarded": "界面变化，重新判断"
  }
};
let language = localStorage.getItem('jev-inspector-language') === 'zh' ? 'zh' : 'en';
let state = {status:'idle',automatic:false};
let online = false;
let requesting = false;
let message = '';
let displayedRun = '';
const t = key => copy[language][key] ?? key;
const node = (tag, className, text) => { const element=document.createElement(tag); if(className)element.className=className; if(text!==undefined)element.textContent=text; return element; };
const idle = () => ['idle','finished','error'].includes(state.status);
const active = () => !idle() && state.status !== 'previewing';
function notice(key) { message=key; renderNotice(); }
function renderNotice() {
  const key=message || (state.hasKey===false?'missing_key':'') || state.error || (state.imageError?'imageError':'');
  $('notice').hidden=!key; $('notice').textContent=key?t(key):'';
}
async function request(path, body) {
  const response=await fetch(path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Jev-Inspector':'1'},body:JSON.stringify(body)});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'request_failed');
  return data;
}
async function perform(work) {
  if(requesting)return;
  requesting=true;notice('');renderControls();
  try{await work();}catch(error){notice(error.message in copy.en?error.message:'request_failed');try{state=await request('/api/state');render();}catch{}}
  finally{requesting=false;renderControls();}
}
function localize() {
  document.documentElement.lang=language==='zh'?'zh-CN':'en';
  document.querySelectorAll('[data-i18n]').forEach(e=>{e.textContent=t(e.dataset.i18n);});
  $('language').textContent=language==='en'?'简体中文':'English';
  $('reload-devices').setAttribute('aria-label',language==='zh'?'刷新设备列表':'Refresh device list');
  $('screen-image').alt=language==='zh'?'Android 手机截图':'Android device screenshot';
  if(!$('device').value&&$('device').options.length===1)$('device').options[0].textContent=t('noneDevices');
}
function renderControls() {
  const editable=idle()&&!requesting&&online;
  for(const id of ['device','goal','app','texts','max-steps','timeout','reload-devices'])$(id).disabled=!editable;
  for(const id of ['start-review','start-auto'])$(id).disabled=!editable||!state.hasKey||!$('device').value;
  $('preview').disabled=!editable||!$('device').value;
  $('step').disabled=requesting||!online||state.status!=='paused'||state.pendingStep===undefined;
  $('toggle-run').disabled=requesting||!online||!active()||state.status==='stopping';
  $('toggle-run').textContent=t(state.automatic?'pause':'resume');
  $('stop').disabled=requesting||!online||!active()||state.status==='stopping';
  document.querySelector('.execution-controls').hidden=!active();
}
function probabilities(container, answer, labels) {
  container.replaceChildren();
  if(!answer?.probabilities){container.append(node('p','placeholder',t('noProb')));return;}
  const entries=Object.entries(answer.probabilities).filter(([,p])=>Number.isFinite(p)).sort((a,b)=>b[1]-a[1]);
  for(const [id,p] of entries){
    const row=node('div','prob-row'+(id===answer.choice?' chosen':''));
    const label=node('span','prob-label',labels(id));label.title=label.textContent;
    const track=node('div','prob-track'),fill=node('div','prob-fill');fill.style.width=`${Math.max(0,Math.min(100,p*100))}%`;track.append(fill);
    row.append(label,node('span','prob-value',`${(p*100).toFixed(1)}%`),track);container.append(row);
  }
}
function render() {
  if(state.runId&&state.runId!==displayedRun){displayedRun=state.runId;if(state.goal)$('goal').value=state.goal;}
  localize();renderNotice();renderControls();
  $('connection').textContent=t(online?'connected':'offline');$('connection').classList.toggle('offline',!online);
  const progress=state.progress,trace=state.result?.trace||progress?.trace||[],calls=state.result?.calls||progress?.calls||[];
  const last=trace.at(-1),phase=progress?.phase;
  const finalStatus=state.result?.status||progress?.finalStatus;
  $('status').textContent=t(state.status==='finished'&&finalStatus?finalStatus:state.status==='running'&&['deciding','writing','acting','discarded'].includes(phase)?phase:state.status);
  $('count').textContent=String(trace.filter(x=>x.outcome==='executed').length);
  const elapsed=state.result?.elapsedMs??progress?.elapsedMs;
  $('elapsed').textContent=elapsed===undefined?'—':`${(elapsed/1000).toFixed(1)} s`;
  const incomplete=calls.some(c=>c.costUsd===null||c.inputTokens===null||c.outputTokens===null);
  $('cost').textContent=calls.length?`${incomplete?'≥ ':''}$${calls.reduce((n,c)=>n+(c.costUsd||0),0).toFixed(6)}`:'—';
  $('tokens').textContent=calls.length?`${calls.reduce((n,c)=>n+(c.inputTokens||0),0).toLocaleString()} / ${calls.reduce((n,c)=>n+(c.outputTokens||0),0).toLocaleString()}`:'—';
  $('call-note').textContent=calls.length?`${calls.length} ${t('calls')} · ${t('lastCall')} ${(calls.at(-1).ms/1000).toFixed(2)} s${incomplete?' · '+t('unknownCost'):''}`:'';
  const summary=$('decision-summary');summary.replaceChildren();summary.classList.toggle('amber',!!finalStatus);
  if(last){
    summary.append(node('div','decision-kicker',t(finalStatus?'finished':'readyDecision')),node('strong','',t(last.action.operation)));
    const label=last.action.targetLabel||last.action.target||'';
    if(label)summary.append(node('p','',label));
    if(last.action.text!==undefined)summary.append(node('p','',`${t('input')}: ${last.action.text}`));
    summary.append(node('p','',t(finalStatus?(last.outcome==='selected'?'not_executed':'terminalHint'):state.status==='paused'?'waitingHint':'autoHint')));
  }else{summary.append(node('div','decision-kicker',t(active()?'thinking':'readyDecision')),node('strong','',t(active()?phase||state.status:'emptyDecision')),node('p','',t('emptyDecisionHint')));}
  const answers=last?.probabilities;
  probabilities($('operations'),answers?.operation,id=>t(id));
  const kind=last?.action.operation==='TAP'?'tap_target':last?.action.operation==='TYPE'?'type_target':null;
  $('target-section').hidden=!kind;
  if(kind)probabilities($('targets'),answers?.[kind],id=>`${id} · ${last.screen.elements.find(e=>e.id===id)?.label||id}`);
  else{$('targets').replaceChildren();}
  const frame=state.frame;
  $('phone').hidden=!frame;$('empty-screen').hidden=!!frame;
  if(frame){
    $('phone').style.setProperty('--phone-ratio',String(frame.width/frame.height));
    if($('screen-image').getAttribute('src')!==frame.data)$('screen-image').src=frame.data;
    $('frame-time').textContent=`${t('snapshotAt')} ${new Date(frame.capturedAt).toLocaleTimeString([], {hour12:false})}`;
    const overlay=$('overlays');overlay.replaceChildren();
    const same=last?.screen.fingerprint===frame.screen.fingerprint;
    for(const element of frame.screen.elements.filter(e=>e.clickable!==false&&e.enabled!==false)){
      const box=node('button','element-box'+(same&&last.action.target===element.id?' selected':''));box.type='button';
      box.title=`${element.id} · ${element.label}`;box.setAttribute('aria-label',box.title);box.append(node('span','',element.id));
      box.style.left=`${element.rect.x/frame.width*100}%`;box.style.top=`${element.rect.y/frame.height*100}%`;
      box.style.width=`${element.rect.width/frame.width*100}%`;box.style.height=`${element.rect.height/frame.height*100}%`;
      // Overlay interaction only highlights an observation; never sends a tap.
      box.onclick=()=>{overlay.querySelectorAll('.selected').forEach(e=>e.classList.remove('selected'));box.classList.add('selected');$('screen-caption').textContent=box.title;};
      overlay.append(box);
    }
  }else $('frame-time').textContent='—';
  const timeline=$('timeline');timeline.replaceChildren();
  if(!trace.length)timeline.append(node('p','placeholder',t('noLog')));
  for(const record of [...trace].reverse()){
    const row=node('div','timeline-row'),outcome=record.outcome==='executed'?'executedOutcome':record.outcome==='reported_complete'?'claimed':record.outcome==='selected'&&finalStatus?'not_executed':record.outcome;
    row.append(node('span','index',String(record.step+1).padStart(2,'0')),node('span','action',t(record.action.operation)),node('span','detail',[record.action.targetLabel,record.action.text].filter(Boolean).join(' · ')||'—'),node('span','outcome'+(record.outcome==='executed'?'':' warning'),t(outcome)));
    timeline.append(row);
  }
}
async function devices() {
  const data=await request('/api/devices'),previous=$('device').value;
  $('device').replaceChildren();
  if(!data.devices.length){$('device').append(new Option(t('noneDevices'),''));notice('device_unavailable');}
  else{
    for(const device of data.devices)$('device').append(new Option(device.name||device.id,device.id));
    const selected=[previous,data.preferredDevice].find(id=>data.devices.some(d=>d.id===id));if(selected)$('device').value=selected;
  }
  renderControls();
}
function start(automatic) {
  if(!$('task-form').reportValidity())return;
  return perform(async()=>{
    const app=$('app').value.trim(),texts=$('texts').value.split('\n').map(x=>x.trim()).filter(Boolean);
    await request('/api/start',{device:$('device').value,goal:$('goal').value,app:app||undefined,texts:texts.length?texts:undefined,maxSteps:Number($('max-steps').value),timeoutMs:Number($('timeout').value)*1000,automatic});
    state=await request('/api/state');render();
  });
}
function control(command) { return perform(async()=>{state=await request('/api/control',{runId:state.runId,command,step:state.pendingStep});render();}); }
$('task-form').onsubmit=event=>{event.preventDefault();start(false);};
$('start-auto').onclick=()=>start(true);
$('step').onclick=()=>control('step');$('toggle-run').onclick=()=>control(state.automatic?'pause':'resume');$('stop').onclick=()=>control('stop');
$('preview').onclick=()=>perform(async()=>{state=await request('/api/preview',{device:$('device').value});render();});
$('reload-devices').onclick=()=>perform(devices);$('device').onchange=()=>{notice('');renderControls();};
$('show-elements').onchange=()=>{$('overlays').classList.toggle('hide-boxes',!$('show-elements').checked);};
$('language').onclick=()=>{language=language==='en'?'zh':'en';localStorage.setItem('jev-inspector-language',language);render();};
render();
const events=new EventSource('/api/events');
events.onopen=()=>{online=true;render();};
events.onmessage=event=>{state=JSON.parse(event.data);render();};
events.onerror=()=>{online=false;render();};
devices().catch(error=>notice(error.message in copy.en?error.message:'request_failed'));
