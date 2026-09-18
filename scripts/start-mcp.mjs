import './local-env.mjs';
process.env.MOBILEMCP_ENABLE_JEV='1';
await import('../lib/index.js');
