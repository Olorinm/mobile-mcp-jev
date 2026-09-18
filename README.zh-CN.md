# Mobile MCP + Jev

[English](README.md) | **简体中文**

**让 Jev 选择下一步手机操作，让 GLM 检查任务是否完成。**

这是 [Mobile MCP](https://github.com/mobile-next/mobile-mcp) 的实验性 fork，增加了由 [Jev](https://vercel.com/ai-gateway/models/jev) 驱动、有步数和时间限制的 Android 多步执行器。参考主 Agent 为 **OpenCode 1.18.31 + GLM 5.3 Flash**。

> **本地小样本测试：两个简单 Android 设置任务中，速度约为原版的 1.8–2.5 倍，API 成本降低 84%–87%。** 每个任务、每种方案各测试三次，均成功。这些成绩只适用于当前测试任务，不能代表普遍的成功率或性能。

## 改了什么

```text
用户目标 → OpenCode / GLM 5.3 Flash
           └─ mobile_jev_run
               读取界面 → 构造选项 → Jev 选择 → 执行 → 循环
           └─ GLM 检查最终屏幕，接着完成未完成的部分
```

- 代码把当前 Android 无障碍控件树转换成选项，无需大模型每一步先替 Jev 出题。
- 一次 Jev 请求同时选择操作和目标。已知输入字符串直接传入，确实需要生成文字时才调用 GLM 文字助手。
- 使用页面变化检查、步数和时间限制、设备锁、无进展检测来限制每次运行。
- 返回动作、最终界面、耗时、Token 和已知 API 费用。模型的 `reported_complete` **不等于独立核验成功**。
- 按需启用：未设置 `MOBILEMCP_ENABLE_JEV=1` 时，仍可使用原版 Mobile MCP。

## 测试结果

同一设备、同一目标，每个任务、每种方案各三次。耗时为**全部尝试**的中位数，费用为每次平均美元估算，包含外层 GLM 调用。

| 任务 | 原版 Mobile MCP + GLM | 初版 Jev 执行器 + GLM | 成功次数：原版 / Jev |
|---|---:|---:|---:|
| 开启深色模式 | 75.07 秒 / $0.005699 | **29.92 秒 / $0.000894** | 3/3 / 3/3 |
| 屏幕超时设为 30 秒 | 40.16 秒 / $0.007104 | **21.79 秒 / $0.000914** | 3/3 / 3/3 |
| 搜索并打开省电模式设置 | 69.44 秒 / ≥ $0.004713 | 22.47 秒 / ≥ $0.000765 | **2/3 / 0/3** |

首轮 18 次尝试中，原版 **8/9 成功**，初版 Jev **6/9 成功**。未完成任务的短耗时不能算作提速。

修正动作历史后，纯 Jev 的三次搜索复测仍全部失败。当前混合方案直接传入已知输入文本，并由 GLM 验收和补救：搜索复测 **3/3 成功**，耗时中位数 **49.41 秒**，平均 API 费用 **$0.003142**。这是单独的后续实验，没有同时重跑基线，不与旧版本合并统计。

[完整成绩与局限](RESULTS.md) · [测量方法与脱敏逐次数据（英文）](benchmarks/README.md)

## 开始体验

参考运行器和基准已在 **Windows + Android 15/API 35** 上验证。Jev 接入当前针对 Android；其他平台能力继承自上游，尚未与 Jev 联合测试。

需要 Node.js 22.12+（测试版本 24.19）、在线 Android 测试模拟器或设备、Android SDK 平台工具，以及能访问 `typesafe-ai/jev` 和 `zai/glm-5.3-flash` 的 Vercel AI Gateway Key。

```powershell
git clone https://github.com/Olorinm/mobile-mcp-jev.git
cd mobile-mcp-jev
npm ci
npm run build
npm install --prefix .local/opencode --save-exact opencode-ai@1.18.31
Copy-Item .env.example .env
# 编辑 .env：密钥、SDK 路径、mobilecli 设备 ID 和 ADB 序列号。
node scripts/opencode-run.mjs jev "Enable Dark theme in Android Display settings."
node scripts/opencode-run.mjs baseline "Enable Dark theme in Android Display settings."
```

`jev` 使用混合执行流程，`baseline` 使用原版工具。手动比较前应恢复相同的初始设置。Windows 用户也可运行 `Try-Jev.cmd` 和 `Try-Baseline.cmd`。

接入其他 MCP 客户端时，启动 `node /absolute/path/to/checkout/scripts/start-mcp.mjs`，将示例路径替换为自己的 checkout 路径。`MOBILE_DEVICE` 应填写 `mobilecli devices` 返回的 ID，它可能与 `adb devices` 的序列号不同。详见 [使用说明](README-JEV.md)。

## 可视化调试

配置 `.env` 并构建后，运行 `npm run inspector`（Windows 也可双击 `Try-Inspector.cmd`），打开 **http://127.0.0.1:4781/**。

本地面板支持中英文，显示手机截图、下一步动作和执行记录。点击**查看下一步**，检查后再单步执行；也可自动运行，在下一步操作前暂停。概率、Token 用量和设备参数按需展开。停止会取消后续工作，已经发送给设备的命令仍可能执行完成。

面板直接运行 Jev，仅在需要生成输入文字时调用 GLM，**不包含**外层 OpenCode / GLM 的验收和接管。截图只保留在会话内存中，任务和界面文字会发送给模型提供方。调试时不要让另一个 MCP 客户端同时操作该设备。截图和人工暂停会增加耗时，不能与上方无界面基准直接比较。

## 复现测试

```powershell
npm run benchmark:jev
# 可选筛选：
$env:BENCH_TASK="settings-search"
$env:BENCH_REPETITIONS="3"
$env:BENCH_MODE="hybrid" # baseline 原版、jev 纯循环、hybrid 混合执行
npm run benchmark:jev
```

默认运行三个任务 × 三次重复 × baseline/hybrid。上方历史表格使用的是**初版纯 Jev**，与当前默认的混合方案不同。

基准只允许在可重置的测试模拟器上运行。它会重置显示设置，并在搜索测试时清除 Settings Intelligence 数据。正常使用工具不会清除应用数据。原始记录保存在本地被 Git 忽略的 `benchmark-results/` 目录。

```powershell
npm run build
npm run lint
npm test
node scripts/test-verification.mjs
```

## 能力范围与数据

这是针对短而明确任务的早期实验，没有为画布或自绘控件增加视觉识别。输入目前追加文字，尚未实现可靠的清空、编辑和长流程操作。参考基准使用英文 Android 设置界面。

任务目标和屏幕文字会发送给 Vercel / 模型提供方。本地运行日志可能包含屏幕文字和输入内容。密钥应保存在被忽略的 `.env`；原始日志和截图不上传到仓库。公开测试文件只包含白名单允许的数值、任务名称和状态。

## 来源与许可证

采用 [Apache-2.0](LICENSE)。基于 `mobile-next/mobile-mcp` 的 `63a5974d9bfa5b66d1ee4d1b0945df3ebea18b11`，详见 [NOTICE](NOTICE)。设计受 [browser-use/jev-ultrafast](https://github.com/browser-use/jev-ultrafast) 启发。本项目是独立实验性 fork，不是 Mobile Next 官方产品。

上游原始英文 README 保留在 [README-UPSTREAM.md](README-UPSTREAM.md)。其中的软件包和注册表安装指令安装的是上游项目。此仓库的 CI 不会发布 npm 包。
