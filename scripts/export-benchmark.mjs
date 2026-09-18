// Export an allowlisted measurement summary; never copy raw logs or UI data.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

const [source, destination, phase] = process.argv.slice(2);
if (!source || !destination || !phase) throw new Error('Usage: node scripts/export-benchmark.mjs <private-run-directory> <public-json> <phase>');
const rows = JSON.parse(readFileSync(join(resolve(source), 'results.json'), 'utf8'));
const modes = new Set(['baseline', 'jev', 'hybrid']);
const tasks = new Set(['dark-theme', 'screen-timeout', 'settings-search']);
const statuses = new Set(['reported_complete','blocked','step_limit','cancelled_or_timeout','error','no_progress','unstable_screen']);
const number = n => Number.isFinite(n) && n >= 0 ? n : null;
const runs = rows.map(r => {
  if (!modes.has(r.mode) || !tasks.has(r.task)) throw new Error('Unrecognized task or mode');
  const j = r.jev;
  return {
    task: r.task, mode: r.mode, repetition: number(r.repeat + 1), success: r.verification.success === true,
    elapsedMs: number(r.elapsedMs), knownCostUsd: number(r.totalCostUsd),
    accountingComplete: !r.timedOut && r.exitCode === 0 && !r.errors?.length && r.outer.completeAccounting !== false && j?.usage.completeAccounting !== false,
    outer: {
      calls: number(r.outer.calls), inputTokens: number(r.outer.inputTokens), outputTokens: number(r.outer.outputTokens),
      reasoningTokens: number(r.outer.reasoningTokens), cacheReadTokens: number(r.outer.cacheReadTokens), costUsd: number(r.outer.costUsd),
    },
    inner: j ? {
      calls: number(j.calls.length), inputTokens: number(j.usage.inputTokens), outputTokens: number(j.usage.outputTokens), knownCostUsd: number(j.usage.knownCostUsd),
      status: statuses.has(j.status) ? j.status : 'unknown',
    } : null,
  };
});
const output = resolve(destination);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify({
  schemaVersion: 1, phase, date: '2026-09-18', environment: 'Windows; Android 15/API 35 emulator; 720x1280',
  versions: { opencode: '1.18.31', aiSdk: '7.0.105', baselineModel: 'zai/glm-5.3-flash', evaluator: 'typesafe-ai/jev', upstream: '63a5974d9bfa5b66d1ee4d1b0945df3ebea18b11' },
  note: 'Allowlisted per-run measurements only. Raw logs, UI text, screenshots, IDs, absolute paths and credentials are excluded. Missing usage is not zero.',
  runs,
}, null, 2) + '\n');
console.log(`Exported ${runs.length} measurement records.`);
