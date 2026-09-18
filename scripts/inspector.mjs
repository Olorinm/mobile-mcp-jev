import { existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInspectorApp } from '../lib/inspector-server.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
if (process.env.ANDROID_HOME) {
  process.env.ANDROID_SDK_ROOT ||= process.env.ANDROID_HOME;
  process.env.PATH = join(process.env.ANDROID_HOME, 'platform-tools') + (process.platform === 'win32' ? ';' : ':') + process.env.PATH;
}
process.env.MOBILEMCP_DISABLE_TELEMETRY = '1';
const port = Number(process.env.JEV_INSPECTOR_PORT || 4781);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid JEV_INSPECTOR_PORT');
const {app, session} = createInspectorApp({port});
const server = app.listen(port, '127.0.0.1', () => console.log(`Jev Inspector: http://127.0.0.1:${port}`));
server.on('error', () => { console.error('Inspector could not start. Check whether the local port is already in use.'); process.exitCode = 1; });
for (const event of ['SIGINT', 'SIGTERM']) process.on(event, () => {
  session.close();
  server.close(); server.closeAllConnections();
});
