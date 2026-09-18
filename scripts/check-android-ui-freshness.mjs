// On-device regression for stale, non-empty Chrome accessibility trees.
// No model calls; use an awake, unlocked, idle Android device with Chrome installed.
import './local-env.mjs';
import { device, root } from './local-env.mjs';
import { MobileDevice } from '../lib/mobile-device.js';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const serial = process.env.ANDROID_SERIAL;
if (!serial) throw new Error('Set ANDROID_SERIAL to the test device shown by adb devices.');
const adb = join(process.env.ANDROID_HOME, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const command = (...args) => execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8', timeout: 15000, windowsHide: true });
const robot = new MobileDevice(device);
const fixture = readFileSync(join(root, 'test/fixtures/android-ui-freshness.html'));
const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
  res.end(fixture);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const label = element => element.label || element.text || '';
const report = { rounds: [], passed: false };
let forwarded = false;
let phase = 'preflight';
const fail = message => { const error = new Error(message); error.publicMessage = message; throw error; };
try {
  if (!command('shell', 'dumpsys', 'power').includes('mWakefulness=Awake')) {
    fail('Wake and unlock the test device before running this regression.');
  }
  command('reverse', `tcp:${port}`, `tcp:${port}`);
  forwarded = true;
  for (let round = 0; round < 3; round++) {
    phase = 'open_fixture';
    await robot.openUrl(`http://127.0.0.1:${port}/?round=${round}`);
    await delay(1500);
    let elements;
    let button;
    phase = 'read_initial_controls';
    for (let attempt = 0; attempt < 6; attempt++) {
      elements = await robot.getDetailedElementsOnScreen();
      button = elements.find(e => label(e) === 'Dismiss diagnostic dialog');
      if (button) break;
      await delay(250);
    }
    if (!button) fail('Initial diagnostic controls are missing.');
    phase = 'dismiss_dialog';
    const { x, y, width, height } = button.rect;
    await robot.tap(x + width / 2, y + height / 2);
    const start = performance.now();
    let reads = 0;
    let changed = false;
    phase = 'read_changed_controls';
    do {
      elements = await robot.getDetailedElementsOnScreen();
      reads++;
      const labels = elements.map(label);
      changed = labels.includes('DIAGNOSTIC NEW FORM') && labels.includes('Diagnostic search')
        && !labels.includes('DIAGNOSTIC OLD DIALOG') && !labels.includes('Dismiss diagnostic dialog');
      if (changed) break;
      await delay(250);
    } while (performance.now() - start < 3000);
    const result = { round: round + 1, changed, reads, elapsedMs: Math.round(performance.now() - start) };
    report.rounds.push(result);
    console.log(JSON.stringify(result));
    if (!changed) fail('Accessibility tree remained stale after the DOM changed.');
  }
  report.passed = true;
} catch (error) {
  report.error = error.publicMessage || `Android device operation failed during ${phase}.`;
  process.exitCode = 1;
} finally {
  server.closeAllConnections();
  server.close();
  if (forwarded) {
    try { command('reverse', '--remove', `tcp:${port}`); }
    catch { report.cleanupFailed = true; report.passed = false; process.exitCode = 1; }
  }
  mkdirSync(join(root, 'benchmark-results'), { recursive: true });
  writeFileSync(join(root, 'benchmark-results', `ui-freshness-${Date.now()}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, error: report.error }));
}
