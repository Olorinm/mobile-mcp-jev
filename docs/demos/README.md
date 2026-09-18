# Recorded Android flight search

**English** | [简体中文](README.zh-CN.md)

[Watch/download the complete recording](https://github.com/Olorinm/mobile-mcp-jev/raw/refs/heads/main/docs/demos/skyscanner-2026-09-18.mp4) · [Sanitized measurements](skyscanner-2026-09-18.json) · [Executor source](https://github.com/Olorinm/mobile-mcp-jev/commit/1f0b2d5573059af97439dd9149d32f7d52fdba66)

<a href="https://github.com/Olorinm/mobile-mcp-jev/raw/refs/heads/main/docs/demos/skyscanner-2026-09-18.mp4"><img src="skyscanner-2026-09-18.jpg" width="270" alt="Recorded result: Shanghai to Tokyo, October 20 to 25, one adult, economy"></a>

Recorded September 18, 2026. Jev operated the Skyscanner website in Android Chrome. The final screen showed Shanghai (Any)–Tokyo (Any), October 20–25, one adult, economy, and actual flight cards. Calendar selections confirm the year 2026. Some providers were still updating prices; the goal required visible results, not completion of every provider search. No booking or payment was made.

| Measurement | Recorded rerun |
|---|---:|
| Executor wall time | 70.225 s |
| Executed actions, including one WAIT | 18 |
| Jev evaluations | 21 |
| DeepSeek text calls | 1 |
| Reported total API cost | $0.01125449 |
| Input / output tokens | 259,148 / 18,426 |
| Device observation / validation | 43.064 s |
| Model requests | 19.971 s |
| Device actions | 6.677 s |
| Explicit wait | 0.359 s |

The recording is about 73.35 seconds, including the surrounding phone display. It is one continuous Android screen recording at original speed, without cuts, with no audio or desktop content. The MP4 keeps the original H.264 video stream; auxiliary data streams and metadata were removed. Recording and live inspector screenshots can affect performance.

## Conditions and limits

- The browser was prepared before timing: homepage open, Shanghai (Any) selected, destination and dates empty, one adult and economy already selected. Browser state/caches from earlier tests were retained.
- Android 15/API 35 emulator, software rendering, 1080×2400 device display; recording at 720×1600. MobileCLI 1.0.9 with the [local cache patch](../../patches/mobilecli/README.md), plus this fork's Chrome fallback.
- Same executor and goal as the preceding unrecorded 76.40-second check. This was the first and only recording attempt for this rerun, not the first overall development attempt. Earlier failed development runs are excluded from both single-run timings.
- The inspector directly ran `typesafe-ai/jev`. `deepseek/deepseek-v4.1-flash` generated the input `Tokyo`, with reasoning requested off. There was no outer OpenCode agent, visual-model takeover, human action during execution, or task-specific date-correction code.
- The existing general prompt, selected-tab filtering, repeated state/action option filtering, and step/time limits remained enabled. This demonstrates the current executor, not the model in isolation. The bounds were 40 decision steps and 300 seconds.
- Jev initially chose October 24 as the return date, revisited the calendar and ultimately selected October 25. These detours remain in the video and measurements. Two later decisions were discarded because the result screen changed; the executor requested fresh decisions.
- The executor returned `reported_complete`, with its own `verified` field still false. Final route, dates, passengers, cabin and flight cards were checked separately against the screen. That check did not change the phone state or enter the timed run.
- Cost is the API gateway's reported sum for this run, with complete usage accounting. It excludes hardware, electricity and recording costs. No baseline was rerun; these numbers establish no speed or cost advantage over another agent.

## Task supplied to the executor

```text
Use the visible Skyscanner search form to search round-trip flights: origin Shanghai (Any), destination Tokyo (Any), departure 20 October 2026, return 25 October 2026, 1 adult, economy. Both cities must include all airports, not one particular airport. Use on-screen controls to set the fields; do not construct a search URL. Finish when actual flight results with these criteria are visible. Do not book, pay, sign in, or bypass verification challenges.
```

After configuring the [inspector](../../README.md#visual-inspector), prepare the same starting state and run this goal automatically. Availability, prices, page structure and network latency can change. The public JSON contains an allowlisted measurement summary and action descriptions; raw device/session identifiers, gateway generation IDs, credentials and local paths are excluded. The phone used no signed-in personal account.
