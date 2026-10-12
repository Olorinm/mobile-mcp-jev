# Mobile MCP + Jev

[English](README.md) | **简体中文**

**让 Jev 选择下一步手机操作，让 DeepSeek 检查任务是否完成。**

这是 [Mobile MCP](https://github.com/mobile-next/mobile-mcp) 的实验性 fork，增加了由 [Jev](https://vercel.com/ai-gateway/models/jev) 驱动、有步数和时间限制的 Android 多步执行器。当前参考主 Agent 为 **OpenCode 1.18.31 + DeepSeek V4.1 Flash**。下方已公布的成绩使用 GLM 5.3 Flash，尚未用 DeepSeek 重跑。

> **本地小样本测试：两个简单 Android 设置任务中，速度约为原版的 1.8–2.5 倍，API 成本降低 84%–87%。** 每个任务、每种方案各测试三次，均成功。这些成绩只适用于当前测试任务，不能代表普遍的成功率或性能。

## 查机票实录

[观看完整原速手机录屏（MP4，73 秒）](https://github.com/Olorinm/mobile-mcp-jev/raw/refs/heads/main/docs/demos/skyscanner-2026-09-18.mp4) · [运行说明与测量记录](docs/demos/README.zh-CN.md)

上海至东京，2026 年 10 月 20–25 日往返，1 成人、经济舱。本次录屏重跑在 **70.23 秒**内展示实际航班列表，执行 **18 次操作**，接口报告费用 **$0.011254**。录像保留了选错日期和 Jev 随后自行纠正的过程。这是一次功能演示，未配对测试基线；本次运行没有外层 OpenCode。

## 改了什么

```text
用户目标 → OpenCode / DeepSeek V4.1 Flash
           └─ mobile_jev_run
               读取界面 → 构造选项 → Jev 选择 → 执行 → 循环
           └─ DeepSeek 检查最终屏幕，接着完成未完成的部分
```

- 代码把当前 Android 无障碍控件树转换成选项，无需大模型每一步先替 Jev 出题。
- 一次 Jev 请求同时选择操作和目标。已知输入字符串直接传入，确实需要生成文字时才调用 DeepSeek 文字助手。
- 已安装应用也会动态生成选项，放入同一次判断。支持启动应用、回桌面、点击、长按、输入、四向滑动、返回、回车和等待。通用提示词依据目标、前台应用、控件和动作结果判断，不包含特定任务的导航路线。
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

修正动作历史后，纯 Jev 的三次搜索复测仍全部失败。当时的混合实验直接传入已知输入文本，并由 GLM 验收和补救：搜索复测 **3/3 成功**，耗时中位数 **49.41 秒**，平均 API 费用 **$0.003142**。这是单独的后续实验，没有同时重跑基线，不与旧版本合并统计。

[完整成绩与局限](RESULTS.md) · [测量方法与脱敏逐次数据（英文）](benchmarks/README.md)

当前版本功能验证：Jev + DeepSeek V4.1 Flash 已完成天巡查票，最终屏幕显示**上海所有机场 → 东京所有机场，2026 年 10 月 20–25 日往返，1 成人、经济舱**，并核对了实际航班列表和筛选条件。从已打开、已选上海的首页开始，单次耗时 **76.40 秒**、执行 **22 次操作**、接口报告费用 **$0.012903**，包含自行纠正错误的日期选择。使用 Android 15/API 35 模拟器、软件渲染和实时截图。这是一次功能验证，未配对重跑基线；此前失败尝试未计入这次运行的耗时，不能据此宣称普遍提速或降本。

## 开始体验

参考运行器和基准已在 **Windows + Android 15/API 35** 上验证。Jev 接入当前针对 Android；其他平台能力继承自上游，尚未与 Jev 联合测试。

需要 Node.js 22.12+（测试版本 24.19）、在线 Android 测试模拟器或设备、Android SDK 平台工具，以及能访问 `typesafe-ai/jev` 和 `deepseek/deepseek-v4.1-flash` 的 Vercel AI Gateway Key。

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

Android Chrome 出现“画面已更新、控件仍停在旧状态”时，可使用 [patches/mobilecli](patches/mobilecli/README.md) 中的缓存刷新补丁和设备回归测试。编译后通过 `MOBILECLI_PATH` 选择修补版；默认 npm 依赖仍是上游原版。

配置 `.env` 并构建后，运行 `npm run inspector`（Windows 也可双击 `Try-Inspector.cmd`），打开 **http://127.0.0.1:4781/**。

本地面板支持中英文，显示手机截图、下一步动作和执行记录。点击**查看下一步**，检查后再单步执行；也可自动运行，在下一步操作前暂停。概率、Token 用量和设备参数按需展开。停止会取消后续工作，已经发送给设备的命令仍可能执行完成。

Jev 和 DeepSeek 请求遇到 HTTP 503 时，分别等待 1 秒、2 秒，最多重试两次。面板显示重试进度和最终错误；停止和任务超时会中断等待，每次请求都计入记录，手机操作不会重放。

可选的应用包名留空时，从当前界面开始，由 Jev 选择已安装应用。“目标应用”分组会显示应用选项。当前导航策略已不同于上方历史基准所用版本，本次更新未重跑那组性能比较。

面板直接运行 Jev，仅在需要生成输入文字时调用 DeepSeek，**不包含**外层 OpenCode / DeepSeek 的验收和接管。画面独立异步刷新，同一时间只截一张，完成后间隔 500 毫秒再刷新。判断和操作无需等待截图，最终画面可能稍晚于任务结束出现。控件框仅在手动审阅或静态预览中显示，避免将旧控件叠到运行中的新画面。截图只保留在会话内存中，任务和界面文字会发送给模型提供方。调试时不要让另一个 MCP 客户端同时操作该设备。人工暂停以及设备、网络的资源竞争仍会影响耗时；历史无界面基准与本版本不是配对对比。

Android Chrome 返回空的网页控件树时，读取器通过本地 ADB / DevTools 通道读取当前可见标签页，排除隐藏、被遮挡及屏幕外的控件，并在操作前重新检查目标。该后备通道需要本地 ADB 和 Chrome 调试接口，不覆盖所有第三方 WebView。网页控件仍不可用时会停止任务，不再把只有地址栏的观察交给 Jev。

DeepSeek V4.1 Flash 文字助手只使用校验过的 `write_text` 工具参数，并请求关闭推理（`reasoning: "none"`）；分析文字不会被输入页面。记录中保留推理片段数量及接口报告的推理 Token。对于反复出现的“同一画面、同一操作”，代码会从 Jev 的选项中移除已重复尝试的动作，打断短距离导航循环。

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

任务目标、屏幕文字、已安装应用名称和包名、前台应用会发送给 Vercel / 模型提供方。本地运行日志可能包含屏幕文字和输入内容。密钥应保存在被忽略的 `.env`；原始日志和截图不上传到仓库。公开测试文件只包含白名单允许的数值、任务名称和状态。

## 来源与许可证

采用 [Apache-2.0](LICENSE)。基于 `mobile-next/mobile-mcp` 的 `63a5974d9bfa5b66d1ee4d1b0945df3ebea18b11`，详见 [NOTICE](NOTICE)。设计受 [browser-use/jev-ultrafast](https://github.com/browser-use/jev-ultrafast) 启发。本项目是独立实验性 fork，不是 Mobile Next 官方产品。

上游原始英文 README 保留在 [README-UPSTREAM.md](README-UPSTREAM.md)。其中的软件包和注册表安装指令安装的是上游项目。此仓库的 CI 不会发布 npm 包。
