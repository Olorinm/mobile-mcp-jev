# Mobile MCP + Jev

**Let Jev choose the next Android action. Let GLM verify the result.**

An experimental [Mobile MCP](https://github.com/mobile-next/mobile-mcp) fork that adds a bounded, multi-step Android executor driven by [Jev](https://vercel.com/ai-gateway/models/jev). The reference agent is **OpenCode 1.18.31 + GLM 5.3 Flash**.

> **Small local benchmark: 1.8–2.5× the baseline speed and 84–87% lower API cost on two simple Android settings tasks.** Both approaches succeeded in all three trials per task. These are preliminary task-specific results, not a general success-rate or performance claim.

中文概括：在两个简单系统设置任务中，速度约为原版的 **1.8–2.5 倍**，API 成本约为原版的 **13%–16%**。搜索任务暴露了 Jev 提前宣布完成的问题，因此默认体验保留 GLM 验收和接管。[完整成绩与局限](RESULTS.md) · [中文使用说明](README-JEV.md)

## What changes

```text
User goal → OpenCode / GLM 5.3 Flash
            └─ mobile_jev_run
                observe UI → build choices → Jev selects → execute → repeat
            └─ GLM inspects the final screen and finishes incomplete work
```

- Code turns the current Android accessibility tree into choices. A large model does not write questions on every step.
- One Jev evaluation selects an operation and its target. Known input strings are passed directly; a GLM text helper is used only when needed.
- Screen-change checks, step/time bounds, a per-device lock and no-progress detection limit each run.
- Returns actions, the final UI, latency, tokens and known API cost. A model's `reported_complete` is **not** independent verification.
- Opt-in: ordinary Mobile MCP behavior remains available without `MOBILEMCP_ENABLE_JEV=1`.

## Results

Same device and goal, three trials per task and approach. Times are medians over **all attempts**; costs are mean estimated USD per attempt, including outer GLM calls.

| Task | Original Mobile MCP + GLM | Initial Jev executor + GLM | Success: original / Jev |
|---|---:|---:|---:|
| Enable dark theme | 75.07 s / $0.005699 | **29.92 s / $0.000894** | 3/3 / 3/3 |
| Set screen timeout to 30 seconds | 40.16 s / $0.007104 | **21.79 s / $0.000914** | 3/3 / 3/3 |
| Search for and open Battery Saver | 69.44 s / ≥ $0.004713 | 22.47 s / ≥ $0.000765 | **2/3 / 0/3** |

The initial 18-attempt comparison was **8/9 successful for the baseline, 6/9 for Jev**. A shorter failed run is not a speed win.

After an action-history fix, pure Jev still failed all three search follow-ups. The current hybrid approach supplies literal input text and lets GLM verify and recover: **3/3 search follow-ups succeeded**, with **49.41 s median** and **$0.003142 mean API cost**. These were separate follow-ups, not a new paired comparison, and are not pooled with earlier versions.

[Methodology and limitations](RESULTS.md) · [Sanitized per-run measurements](benchmarks/README.md)

## Try it

The reference runner and benchmark were validated on **Windows + Android 15/API 35**. The Jev integration targets Android; other platforms are inherited from upstream and were not tested with Jev.

Requirements: Node.js 22.12+ (tested: 24.19), an online Android test emulator/device, Android SDK platform tools, and a Vercel AI Gateway key with access to `typesafe-ai/jev` and `zai/glm-5.3-flash`.

```powershell
git clone https://github.com/Olorinm/mobile-mcp-jev.git
cd mobile-mcp-jev
npm ci
npm run build
npm install --prefix .local/opencode --save-exact opencode-ai@1.18.31
Copy-Item .env.example .env
# Edit .env: API key, SDK path, mobilecli device ID, and ADB serial.
node scripts/opencode-run.mjs jev "Enable Dark theme in Android Display settings."
node scripts/opencode-run.mjs baseline "Enable Dark theme in Android Display settings."
```

`jev` uses the hybrid path; `baseline` uses the original tools. Reset the initial setting between manual comparisons. Windows users can also use `Try-Jev.cmd` and `Try-Baseline.cmd`.

For another MCP client, launch `node /absolute/path/to/checkout/scripts/start-mcp.mjs`. Set `MOBILE_DEVICE` to the ID from `mobilecli devices`; it may differ from the serial in `adb devices`. See [setup details](README-JEV.md).

## Reproduce

```powershell
npm run benchmark:jev
# Optional filters:
$env:BENCH_TASK="settings-search"
$env:BENCH_REPETITIONS="3"
$env:BENCH_MODE="hybrid" # baseline, jev (pure), or hybrid
npm run benchmark:jev
```

The default is three tasks × three repetitions × baseline/hybrid. The historical table above used the **initial pure Jev version**, not the current hybrid default.

The benchmark is restricted to a disposable emulator. It resets display settings and clears Settings Intelligence data for search trials. Normal tool use does not clear app data. Raw runs remain local in the ignored `benchmark-results/` directory.

```powershell
npm run build
npm run lint
npm test
node scripts/test-verification.mjs
```

## Scope and data

This is an early experiment for short, structured tasks. It does not add vision for canvas/custom controls. Input appends text; reliable clearing/editing and long workflows are not implemented. The reference benchmark uses English Android settings.

Task goals and screen text are sent to Vercel/model providers. Local run logs may include screen text and inputs. Keep credentials in ignored `.env`; raw logs and screenshots are excluded from this repository. Public benchmark files contain only allowlisted numeric results and task/status labels.

## Attribution and license

[Apache-2.0](LICENSE). Based on `mobile-next/mobile-mcp` at `63a5974d9bfa5b66d1ee4d1b0945df3ebea18b11`; see [NOTICE](NOTICE). Inspired by [browser-use/jev-ultrafast](https://github.com/browser-use/jev-ultrafast). Independent experimental fork; not an official Mobile Next product.

The original README is retained as [README-UPSTREAM.md](README-UPSTREAM.md). Upstream registry/package instructions install the upstream project, not this fork. No npm release is published by this repository's CI.
