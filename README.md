# Mobile MCP + Jev

**English** | [简体中文](README.zh-CN.md)

**Let Jev choose the next Android action. Let DeepSeek verify the result.**

An experimental [Mobile MCP](https://github.com/mobile-next/mobile-mcp) fork that adds a bounded, multi-step Android executor driven by [Jev](https://vercel.com/ai-gateway/models/jev). The current reference agent is **OpenCode 1.18.31 + DeepSeek V4.1 Flash**. Published benchmark results below used GLM 5.3 Flash and have not been rerun with DeepSeek.

> **Small local benchmark: 1.8–2.5× the baseline speed and 84–87% lower API cost on two simple Android settings tasks.** Both approaches succeeded in all three trials per task. These are preliminary task-specific results, not a general success-rate or performance claim.

## Recorded flight search

[Watch the full, real-time phone recording (MP4, 73 s)](https://github.com/Olorinm/mobile-mcp-jev/raw/refs/heads/main/docs/demos/skyscanner-2026-09-18.mp4) · [Run details and measurements](docs/demos/README.md)

Shanghai–Tokyo, October 20–25, 2026, one adult in economy. This recorded rerun reached actual flight results in **70.23 s**, with **18 executed actions** and **$0.011254** in reported API cost. The video retains a wrong date selection and Jev's subsequent correction. One functional demonstration, with no paired baseline; OpenCode was not in this run.

## What changes

```text
User goal → OpenCode / DeepSeek V4.1 Flash
            └─ mobile_jev_run
                observe UI → build choices → Jev selects → execute → repeat
            └─ DeepSeek inspects the final screen and finishes incomplete work
```

- Code turns the current Android accessibility tree into choices. A large model does not write questions on every step.
- One Jev evaluation selects an operation and its target. Known input strings are passed directly; a DeepSeek text helper is used only when needed.
- Installed apps become dynamic choices in that same evaluation. Jev can launch an app, go Home, tap/long-press, type, swipe in four directions, go Back, press Enter or wait. The shared policy uses the goal, foreground app, controls and action outcomes; it contains no task-specific navigation routes.
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

After an action-history fix, pure Jev still failed all three search follow-ups. The historical hybrid experiment supplied literal input text and let GLM verify and recover: **3/3 search follow-ups succeeded**, with **49.41 s median** and **$0.003142 mean API cost**. These were separate follow-ups, not a new paired comparison, and are not pooled with earlier versions.

[Detailed results and limitations (Chinese)](RESULTS.md) · [Methodology and sanitized per-run measurements](benchmarks/README.md)

Current-version smoke check: Jev + DeepSeek V4.1 Flash reached visible Skyscanner flight results for Shanghai (Any)–Tokyo (Any), October 20–25, 2026, one adult in economy. The route, dates and cabin were checked against the final screen. Starting from the open homepage with Shanghai already selected, the run took **76.40 s**, **22 actions**, and **$0.012903** in reported API cost, including correcting a date selection. It used an Android 15/API 35 emulator with software rendering and live screenshots. This is one functional check, not a paired speed/cost benchmark; earlier failed attempts are not included in that single-run timing.

## Try it

The reference runner and benchmark were validated on **Windows + Android 15/API 35**. The Jev integration targets Android; other platforms are inherited from upstream and were not tested with Jev.

Requirements: Node.js 22.12+ (tested: 24.19), an online Android test emulator/device, Android SDK platform tools, and a Vercel AI Gateway key with access to `typesafe-ai/jev` and `deepseek/deepseek-v4.1-flash`.

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

For another MCP client, launch `node /absolute/path/to/checkout/scripts/start-mcp.mjs`. Set `MOBILE_DEVICE` to the ID from `mobilecli devices`; it may differ from the serial in `adb devices`. See [setup details (Chinese)](README-JEV.md).

## Visual inspector

For Android Chrome pages whose controls remain stale after the screen changes, a local MobileCLI cache-refresh patch and an on-device regression check are provided in [patches/mobilecli](patches/mobilecli/README.md). Select the rebuilt dependency with `MOBILECLI_PATH`; the default npm binary is unchanged.

After configuring `.env` and building, run `npm run inspector` (or `Try-Inspector.cmd` on Windows), then open **http://127.0.0.1:4781/**.

The local English/Chinese panel shows the phone screenshot, next action and execution log. Use **Review step** to inspect a decision before executing it, or run automatically and pause before the next action. Probabilities, token usage and device options expand on demand. Stop cancels subsequent work; a device command already sent may still finish.

Leave the optional app package empty to start from the current screen and let Jev choose an installed app. Application choices appear under **Target app**. The current navigation policy differs from the versions used in the historical benchmark table; those measurements have not been rerun for this update.

This panel runs Jev directly, with DeepSeek only for input text when needed. It does **not** include the outer OpenCode/DeepSeek verification and recovery loop. Screenshots refresh independently, one asynchronous capture at a time, with a 500 ms interval between captures. Decisions and actions never wait for a frame; the final frame may arrive after completion. Control overlays appear in manual review or a static preview, where they can be associated with an observation. Screenshots stay in session memory; task and UI text go to the model provider. Do not drive the same device from another MCP client during inspection. Manual pauses and shared device/network load still affect timings; the historical headless benchmark is not a matched comparison with this version.

When Android Chrome returns an empty web-content tree, the Android adapter reads the visible tab's accessibility tree through its local ADB/DevTools socket. It excludes hidden, covered and offscreen controls and rechecks web targets before acting. This fallback requires local ADB and Chrome's debugging socket; it does not cover every third-party WebView. An unavailable web tree stops the task instead of handing Jev an address-bar-only observation.

The DeepSeek V4.1 Flash text helper returns a validated `write_text` tool argument with reasoning requested off (`reasoning: "none"`). Analysis prose is never used as input text. Metrics record returned reasoning parts and reported reasoning tokens. Repeated state/action pairs are removed from Jev's offered choices to interrupt short navigation loops.

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

Task goals, screen text, installed app names/packages and the foreground app are sent to Vercel/model providers. Local run logs may include screen text and inputs. Keep credentials in ignored `.env`; raw logs and screenshots are excluded from this repository. Public benchmark files contain only allowlisted numeric results and task/status labels.

## Attribution and license

[Apache-2.0](LICENSE). Based on `mobile-next/mobile-mcp` at `63a5974d9bfa5b66d1ee4d1b0945df3ebea18b11`; see [NOTICE](NOTICE). Inspired by [browser-use/jev-ultrafast](https://github.com/browser-use/jev-ultrafast). Independent experimental fork; not an official Mobile Next product.

The original README is retained as [README-UPSTREAM.md](README-UPSTREAM.md). Upstream registry/package instructions install the upstream project, not this fork. No npm release is published by this repository's CI.
