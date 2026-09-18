# Mobile MCP + Jev 使用说明

本项目是 Mobile MCP 的实验性 fork，主 Agent 为 **OpenCode 1.18.31 + GLM 5.3 Flash**，Jev 通过 Vercel AI Gateway / AI SDK 7.0.105 接入。默认流程是 **Jev 连续执行 → GLM 检查完整目标 → 必要时用原版工具接管**。

## 安装

参考运行器和基准在 Windows + Android 15 模拟器上验证，需要 Node.js 22.12+、Android SDK / ADB、在线测试设备，以及可访问 Jev 和 GLM 的 Vercel AI Gateway Key。

```powershell
git clone https://github.com/Olorinm/mobile-mcp-jev.git
cd mobile-mcp-jev
npm ci
npm run build
npm install --prefix .local/opencode --save-exact opencode-ai@1.18.31
Copy-Item .env.example .env
```

编辑本地 `.env`：填入密钥、SDK 安装目录、`MOBILE_DEVICE` 和 `ANDROID_SERIAL`。设备名称应取自 `mobilecli devices`，ADB 序列号取自 `adb devices`，两者可能不同。通过 Android Studio Device Manager 或自己的启动方式启动模拟器。没有设备时应先创建 Android 15/API 35 测试模拟器。

```powershell
node scripts/opencode-run.mjs jev "Enable Dark theme in Android Display settings."
node scripts/opencode-run.mjs baseline "Enable Dark theme in Android Display settings."
```

也可双击 `Try-Jev.cmd` 或 `Try-Baseline.cmd`，默认开启深色模式。比较之前先恢复浅色模式。直接运行内部纯 Jev 循环：`npm run jev -- "Open Display settings and enable Dark theme."`。

## 作为 MCP 使用

客户端 command 为 Node 可执行文件，args 为 checkout 内 `scripts/start-mcp.mjs` 的绝对路径。该入口读取项目 `.env` 并启用 `mobile_jev_run`。原版入口 `lib/index.js` 只有设置 `MOBILEMCP_ENABLE_JEV=1` 时才注册新工具。

参数：`device`、`goal`；可选 `maxSteps`（默认 16，最大 40）、`timeoutMs`（默认 120000）、`texts`（用户明确提供的输入字符串）。先由主 Agent 打开起始应用，再把短任务交给 Jev。Jev 在云端推理，循环和手机连接在电脑上运行。

主 Agent 应核对返回的 `finalScreen`。`reported_complete` 只是 Jev 的判断，不等于核验成功。Jev 的 `e1` 编号仅在内部快照有效；接管时重新用原版读屏工具获取其控件编号。

## 如何放大 Jev 的优势

1. 代码保留控件的可点击、可见、启用和勾选状态，并合并可点击容器与子文本。
2. 同一请求同时选择操作、目标以及已知输入文本；只执行选中操作对应的答案。
3. 已知输入字符串直接传入，只有确实需要生成文字时才调用 GLM。
4. 点击前重新观察；页面变化就丢弃旧决定。只有已执行动作进入下一轮记忆。
5. 限制步数、运行时间及连续无进展次数。执行记录与模型用量随结果返回。

支持点击、输入、上下滑动、返回、Enter 和等待。没有新增视觉能力、长按、拖动和复杂文本编辑。输入目前追加文字，不适合要求可靠清空旧值的任务。

## 测试及复现

```powershell
npm run benchmark:jev
# 默认：3 个任务 × 3 次 × baseline/hybrid。
$env:BENCH_TASK="settings-search" # dark-theme / screen-timeout / settings-search
$env:BENCH_REPETITIONS="3"
$env:BENCH_MODE="hybrid" # baseline 原版；jev 纯循环；hybrid 验收接管
npm run benchmark:jev
```

基准只允许测试模拟器，会重置主题、屏幕超时和设置首页；搜索任务还会清除 Settings Intelligence 数据并预热空白搜索页。普通工具操作不会清除数据。API 调用会产生费用。

首轮 18 次比较的是原版与初版纯 Jev；后续两组搜索复测分别测试历史修复和混合接管。不同阶段不合并成功率，详见 [RESULTS.md](RESULTS.md)。当前代码包含后续修复，重跑不能视作精确复现首轮旧版本。

外层费用由 OpenCode 根据用量和配置单价估算，内部调用使用 Gateway 返回费用。模型单价以测试日期为准，可能变化。没有返回的账单不当作零。

`npm test` 运行上游和新增测试；设备测试需要对应硬件环境。原始日志、屏幕和截图只保存在本地被忽略的目录，公开的 [benchmarks](benchmarks/README.md) 仅含经过白名单导出的测量数据。

任务目标和屏幕文字会发送给 Vercel / 模型提供方。密钥通过环境变量读取，不应放进提示词、提交记录或公开日志。

参考：[Vercel evaluation API](https://vercel.com/docs/ai-gateway/modalities/evaluation)、[Jev Ultrafast](https://github.com/browser-use/jev-ultrafast)。许可证为 [Apache-2.0](LICENSE)。
