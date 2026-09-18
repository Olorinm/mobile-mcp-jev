import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const dir=process.argv[2] ? resolve(process.argv[2]) : join(root,'benchmark-results',readdirSync(join(root,'benchmark-results')).filter(x=>x.startsWith('opencode-')).sort().at(-1));
const rows=JSON.parse(readFileSync(join(dir,'results.json'),'utf8'));
const median=xs=>{const a=[...xs].sort((x,y)=>x-y);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
const sum=xs=>xs.reduce((a,b)=>a+b,0);
const money=x=>'$'+x.toFixed(6);
const names={'dark-theme':'开启深色模式','screen-timeout':'屏幕超时设为 30 秒','settings-search':'搜索并打开省电模式设置'};
const unknown=r=>r.timedOut||r.exitCode!==0||r.errors?.length>0||r.outer.completeAccounting===false||r.jev?.usage.completeAccounting===false;
const modes=['baseline','jev','hybrid'].filter(mode=>rows.some(r=>r.mode===mode));
const modelNames=[...new Set(rows.map(r=>r.model?.replace('mobile-gateway/','') || 'zai/glm-5.3-flash'))];
const labels={baseline:'原版 Mobile MCP',jev:'Jev 独立执行',hybrid:'Jev + 主 Agent 验收和接管'};
const groups={};
for(const mode of modes) {
  const r=rows.filter(x=>x.mode===mode);
  groups[mode]={n:r.length,success:r.filter(x=>x.verification.success).length,medianSeconds:median(r.map(x=>x.elapsedMs/1000)),
    meanCost:sum(r.map(x=>x.totalCostUsd))/r.length,totalCost:sum(r.map(x=>x.totalCostUsd)),
    totalInput:sum(r.map(x=>x.outer.inputTokens+x.outer.cacheReadTokens+(x.jev?.usage.inputTokens??0))),
    totalOutput:sum(r.map(x=>x.outer.outputTokens+x.outer.reasoningTokens+(x.jev?.usage.outputTokens??0))),
    outerCalls:sum(r.map(x=>x.outer.calls)),internalCalls:sum(r.map(x=>x.jev?.calls.length??0)),incompleteAccountingRuns:r.filter(unknown).length};
}
let report=`# Mobile MCP + Jev 本地对比\n\n测试时间：2026-09-18。结果来自所选本地运行目录。\n\n本目录模型：**${modelNames.join(", ")}**，通过 OpenCode 运行。baseline 由主 Agent 逐步调用原版工具；jev 由主 Agent 调一次 Jev 连续执行工具后汇报；hybrid 先交给 Jev，再由主 Agent 检查最终屏幕并用原版工具补救。手机为 Android 15 / API 35 模拟器。各阶段和版本边界见 [总报告](../../RESULTS.md)。\n\n${modes.length===1?'本目录只有单一方案的复测，不是同一时段的配对 A/B。':'本目录包含配对方案；失败和超时均保留。'}\n\n## 汇总\n\n| 方案 | 独立核验成功 | 全部尝试耗时中位数 | 每次平均费用 | 合计费用 | 外层调用 / 内部调用 |\n|---|---:|---:|---:|---:|---:|\n`;
for(const [mode,g] of Object.entries(groups))report+=`| ${labels[mode]} | ${g.success}/${g.n} | ${g.medianSeconds.toFixed(2)} 秒 | ${g.incompleteAccountingRuns?'≥ ':''}${money(g.meanCost)} | ${g.incompleteAccountingRuns?'≥ ':''}${money(g.totalCost)} | ${g.outerCalls} / ${g.internalCalls} |\n`;
const treatment=groups.hybrid??groups.jev;
if(groups.baseline?.n && treatment?.n) report+=`\n按当前样本，全部尝试耗时中位数变化 **${((1-treatment.medianSeconds/groups.baseline.medianSeconds)*100).toFixed(1)}%**（正数为减少）。失败也在分母和统计中，不能脱离成功率解读。费用不完整的运行数：基线 ${groups.baseline.incompleteAccountingRuns}，Jev 方案 ${treatment.incompleteAccountingRuns}；标有 ≥ 的费用仅为已返回的部分，未完成请求可能另有费用。\n`;
report+='\n## 逐任务\n\n| 任务 | 方案 | 成功 / 次数 | 耗时中位数 | 耗时范围 | 平均费用 |\n|---|---|---:|---:|---:|---:|\n';
for(const task of Object.keys(names))for(const mode of modes){const r=rows.filter(x=>x.task===task&&x.mode===mode);if(!r.length)continue;const sec=r.map(x=>x.elapsedMs/1000);report+=`| ${names[task]} | ${mode} | ${r.filter(x=>x.verification.success).length}/${r.length} | ${median(sec).toFixed(2)} 秒 | ${Math.min(...sec).toFixed(2)}–${Math.max(...sec).toFixed(2)} 秒 | ${r.some(unknown)?'≥ ':''}${money(sum(r.map(x=>x.totalCostUsd))/r.length)} |\n`;}
report+='\n## Token 总量\n\n| 方案 | 输入（含缓存读取） | 输出（含推理） |\n|---|---:|---:|\n';
for(const [mode,g] of Object.entries(groups)) report+=`| ${mode} | ${g.totalInput} | ${g.totalOutput} |\n`;
report+='\n## 每次运行\n\n| 轮次 | 任务 | 方案 | 实际成功 | 秒 | 费用 | Jev 状态 |\n|---:|---|---|---|---:|---:|---|\n';
for(const r of rows)report+=`| ${r.repeat+1} | ${names[r.task]} | ${r.mode} | ${r.verification.success?'是':'否'} | ${(r.elapsedMs/1000).toFixed(2)} | ${unknown(r)?'≥ ':''}${money(r.totalCostUsd)} | ${r.jev?.status??'—'} |\n`;
report+='\n## 统计口径和局限\n\n- 计时从启动 OpenCode 进程到退出，包含 MCP 连接、模型网络延迟、手机操作和最终回复。准备、预热、截图及独立结果核验不计时。两侧相同。\n- 每次恢复设置首页、浅色主题、超时 10 分钟；每轮交替先跑的方案。每次新建 OpenCode 会话，API 缓存由提供方正常处理。\n- 两侧均看界面文字，没有使用截图识别。Jev 使用可点击属性更完整的压缩界面树，因此这是方案对比，不是隔离其他因素的纯模型速度测试。\n- 外层费用来自 OpenCode 的 Token / 运行时配置单价估算，含推理 Token；新运行在 JSON 的 modelPricing 字段记录单价（美元 / 百万 Token）。历史 GLM 配置为输入 $0.15、输出 $0.50、缓存读取 $0.03。Jev 和内部文字助手使用 Gateway 返回费用。合计是混合口径的 API 费用估计，不含电脑、电力或订阅费用。\n- Jev 费用单价为输入 $0.042 / 百万，输出免费。价格记录见本地 `.local/pricing.json`。模型账单缺项见每次 JSON 的 completeAccounting，未知不能视为零。\n- 深色模式、超时使用独立 ADB 系统值核验；搜索任务使用独立 ADB 前台活动和系统值核验，并检查实际搜索输入。`reported_complete` 和实际成功分别保存。\n- 模型失败、超时都保留。准备或核验器调试样本单独排除，原因及原始记录见本目录 EXCLUSIONS.md，没有混入正式统计。\n- 仅少量系统设置任务、单台模拟器、单次网络环境，不能外推第三方 App、视觉任务或长流程。\n\n详见 [使用说明](../../README-JEV.md)。原始 JSON、JSONL 和前后截图在本目录。\n';
if(modes.length===1) report=report.replace('每轮交替先跑的方案','本目录仅复测单一方案').replace('原因及原始记录见本目录 EXCLUSIONS.md','阶段边界和调试记录见总报告 RESULTS.md 的链接');
writeFileSync(join(dir,'REPORT.md'),report);
writeFileSync(join(dir,'summary.json'),JSON.stringify(groups,null,2));
console.log(JSON.stringify({report:join(dir,'REPORT.md'),groups}));
