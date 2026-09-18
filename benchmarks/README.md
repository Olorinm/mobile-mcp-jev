# Public benchmark measurements

These files export only explicitly selected task labels, statuses, numerical measurements and non-identifying environment/version descriptions. They exclude credentials, private links, screen contents, screenshots, device names, user directories, provider generation IDs and session identifiers.

| File | Experiment | Attempts |
|---|---|---:|
| [initial-paired.json](initial-paired.json) | Initial baseline vs. pure Jev; three tasks, three repetitions per approach | 18 |
| [history-fix-search.json](history-fix-search.json) | Search only, pure Jev after the action-history fix | 3 |
| [hybrid-search.json](hybrid-search.json) | Search only, Jev plus GLM verification and recovery | 3 |

Different phases are not pooled. The follow-ups were not paired with simultaneous baseline runs. Current source includes follow-up fixes and uses hybrid by default; it is not the exact initial implementation.

## Accounting

`knownCostUsd` is the observed lower bound when `accountingComplete` is false. OpenCode cost is calculated using configured GLM prices and includes reasoning/cache usage. Internal costs come from Vercel Gateway responses. Do not equate missing charges with zero or sum raw token categories without respecting their definitions.

Outer input total = `inputTokens + cacheReadTokens`; outer output total = `outputTokens + reasoningTokens`. Add inner usage for total tokens. Inner Jev output is free at the recorded price, so output-token count alone does not indicate cost.

Elapsed time covers the OpenCode process, MCP connection, model calls, device actions and final response. Common initial-state reset/warmup, screenshots and independent verification are outside the timer. Each attempt starts a new OpenCode session; provider caching remains enabled.

Recorded prices on 2026-09-18 (USD per million tokens): GLM input 0.15, output 0.50, cache read 0.03; Jev input 0.042, output 0. Prices and provider routing can change.

## Setup corrections and excluded development trials

- Early connectivity and implementation pilots were not scored as formal trials.
- Initial search preparation incorrectly restored a previous query. Merely clearing the field was insufficient. Those preparation-invalid pairs were excluded and rerun after clearing the dedicated Settings Intelligence app data, warming an empty query and returning to Settings home.
- An initial UIAutomator verifier interfered with the observation service. The final search verifier independently inspects the resumed BatterySaverSettings fragment and disabled saver state through ADB, and requires actually executed search input.
- The executed-input checker supports both direct input and successful input steps in the existing batch tool. Discarded decisions do not count. The corrected verifier was applied to all scored search runs using the existing raw logs.
- A manually interrupted development baseline attempt was excluded and rerun. All complete, setup-valid model failures, false completion reports and timeouts remain in the 24 scored attempts above.

Raw records remain private on the experiment machine. The public summaries support recalculating the reported arithmetic; they are not an independently auditable replacement for raw traces. See [RESULTS.md](../RESULTS.md) for findings and limitations.

## Export your own results

```powershell
node scripts/export-benchmark.mjs benchmark-results/YOUR_RUN benchmarks/your-run.json your-phase
```

The exporter constructs a new object using an allowlist; it does not recursively copy or merely redact a raw record. Review the resulting file before publishing.
