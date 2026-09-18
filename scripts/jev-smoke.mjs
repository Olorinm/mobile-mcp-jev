import { createGateway, experimental_evaluate as evaluate } from 'ai';
const gateway = createGateway();
try {
  const start = performance.now();
  const r = await evaluate({ model: gateway.evaluationModel('typesafe-ai/jev'), state: 'The user wants dark mode enabled. The switch is currently off.', questions: { action: { type: 'choice', instructions: 'What next?', criteria: { tap: 'Tap the switch to enable dark mode', done: 'The task is already complete' } } }, maxRetries: 0, abortSignal: AbortSignal.timeout(30000) });
  console.log(JSON.stringify({ ms: performance.now()-start, answers:r.answers, usage:r.usage, metadata:r.providerMetadata }));
} catch(e) { console.log(JSON.stringify({ error: e.name, status:e.statusCode, message: String(e.message).replace(/vck_[A-Za-z0-9]+/g,'[REDACTED]').slice(0,700) })); process.exitCode=1; }
