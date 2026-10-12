import { test, expect } from "@playwright/test";
import { activeJevDevices, JevProgress, runJev } from "../src/jev";
import { Robot } from "../src/robot";

let previousKey: string | undefined;
test.beforeEach(() => { previousKey = process.env.AI_GATEWAY_API_KEY; process.env.AI_GATEWAY_API_KEY = "retry-test-placeholder"; });
test.afterEach(() => { if (previousKey === undefined) { delete process.env.AI_GATEWAY_API_KEY; } else { process.env.AI_GATEWAY_API_KEY = previousKey; } });

const unavailable = () => Object.assign(new Error("Service temporarily unavailable"), { statusCode: 503 });
function answer(questions: any, operation: string) {
	return { answers: Object.fromEntries(Object.entries(questions).map(([key, q]: [string, any]) => {
		const choice = key === "operation" ? operation : Object.keys(q.criteria)[0];
		return [key, { type: "choice", choice, probabilities: Object.fromEntries(Object.keys(q.criteria).map(id => [id, id === choice ? 1 : 0])) }];
	})), usage: { inputTokens: 10, outputTokens: 1 }, providerMetadata: { gateway: { cost: "0.000001" } } };
}
function fixture(type = "Button") {
	const phone = { label: "Search", taps: 0, writes: [] as string[] };
	const robot = {
		getElementsOnScreen: async () => [{ type, label: phone.label, rect: { x: 0, y: 100, width: 200, height: 60 } }],
		tap: async () => { phone.taps++; },
		sendKeys: async (text: string) => { phone.writes.push(text); },
	} as unknown as Robot;
	return { phone, robot };
}

test("503 retries preserve the decision budget and execute the phone action once", async () => {
	const { phone, robot } = fixture();
	let requests = 0;
	const retries: JevProgress["retry"][] = [];
	const result = await runJev(robot, { device: "retry-decision", goal: "Search", maxSteps: 2,
		debug: { onUpdate: p => { if (p.retry) { retries.push(p.retry); } } } }, {
		evaluate: (async ({ questions, maxRetries }: any) => {
			expect(maxRetries).toBe(0); // Avoid hidden retries and missing attempt metrics.
			if (++requests === 1) { throw unavailable(); }
			return answer(questions, phone.taps ? "DONE" : "TAP");
		}) as any,
	});
	expect(result.status).toBe("reported_complete");
	expect(phone.taps).toBe(1);
	expect(requests).toBe(3);
	expect(retries).toEqual([{ model: "typesafe-ai/jev", attempt: 1, maxRetries: 2, delayMs: 1000 }]);
	expect(result.calls).toHaveLength(3);
	expect(result.calls[0]).toMatchObject({ costUsd: null, inputTokens: null, outputTokens: null });
	expect(result.calls[0].error).toContain("HTTP 503");
	expect(result.usage.completeAccounting).toBe(false);
	expect(result.usage.inputTokens).toBe(20);
	expect(result.timing.waitMs).toBeGreaterThanOrEqual(900);
});

test("text generation recovers from 503 without repeating a tap or typing", async () => {
	const { phone, robot } = fixture("EditText");
	let textRequests = 0;
	const result = await runJev(robot, { device: "retry-text", goal: "Search for trains", maxSteps: 2 }, {
		evaluate: (async ({ questions }: any) => answer(questions, phone.writes.length ? "DONE" : "TYPE")) as any,
		generateText: (async () => {
			if (++textRequests === 1) { throw unavailable(); }
			return { toolCalls: [{ toolName: "write_text", input: { text: "trains" } }], usage: { inputTokens: 12, outputTokens: 3 } };
		}) as any,
	});
	expect(result.status).toBe("reported_complete");
	expect(textRequests).toBe(2);
	expect(phone.taps).toBe(1);
	expect(phone.writes).toEqual(["trains"]);
	expect(result.calls.filter(c => c.kind === "text")).toHaveLength(2);
});

test("persistent 503 stops after three total requests and retains every error", async () => {
	const { phone, robot } = fixture();
	let requests = 0;
	const delays: number[] = [];
	const result = await runJev(robot, { device: "retry-exhausted", goal: "Search",
		debug: { onUpdate: p => { if (p.retry) { delays.push(p.retry.delayMs); } } } }, {
		evaluate: (async () => { requests++; throw unavailable(); }) as any,
	});
	expect(requests).toBe(3);
	expect(delays).toEqual([1000, 2000]);
	expect(result.status).toBe("error");
	expect(result.failure).toContain("HTTP 503");
	expect(result.calls).toHaveLength(3);
	expect(result.trace).toHaveLength(0);
	expect(phone.taps).toBe(0);
	expect(activeJevDevices.has("retry-exhausted")).toBe(false);
});

test("authentication errors are returned immediately without retry", async () => {
	const { robot } = fixture();
	let requests = 0;
	const result = await runJev(robot, { device: "retry-auth", goal: "Search" }, {
		evaluate: (async () => { requests++; throw Object.assign(new Error("Unauthorized"), { statusCode: 401 }); }) as any,
	});
	expect(requests).toBe(1);
	expect(result.failure).toContain("HTTP 401");
	expect(result.timing.waitMs).toBe(0);
});

test("stop interrupts a pending backoff and releases the device", async () => {
	const { phone, robot } = fixture();
	const controller = new AbortController();
	let requests = 0;
	let notifyRetry!: () => void;
	const retryStarted = new Promise<void>(resolve => { notifyRetry = resolve; });
	const running = runJev(robot, { device: "retry-stop", goal: "Search", signal: controller.signal,
		debug: { onUpdate: p => { if (p.phase === "retrying") { notifyRetry(); } } } }, {
		evaluate: (async () => { requests++; throw unavailable(); }) as any,
	});
	await retryStarted;
	const stoppedAt = Date.now();
	controller.abort();
	const result = await running;
	expect(Date.now() - stoppedAt).toBeLessThan(500);
	expect(requests).toBe(1);
	expect(phone.taps).toBe(0);
	expect(result.status).toBe("cancelled_or_timeout");
	expect(activeJevDevices.has("retry-stop")).toBe(false);
});

test("the task deadline interrupts backoff without starting a new request", async () => {
	const { robot } = fixture();
	let requests = 0;
	const result = await runJev(robot, { device: "retry-timeout", goal: "Search", timeoutMs: 1000 }, {
		evaluate: (async () => { requests++; throw unavailable(); }) as any,
	});
	expect(result.status).toBe("cancelled_or_timeout");
	expect(requests).toBe(1);
});

test("a screen changed during backoff is revalidated before any action", async () => {
	const { phone, robot } = fixture();
	let requests = 0;
	const result = await runJev(robot, { device: "retry-stale", goal: "Search", maxSteps: 2,
		debug: { onUpdate: p => { if (p.retry) { phone.label = "Results"; } } } }, {
		evaluate: (async ({ questions }: any) => {
			if (++requests === 1) { throw unavailable(); }
			return answer(questions, requests === 2 ? "TAP" : "DONE");
		}) as any,
	});
	expect(result.status).toBe("reported_complete");
	expect(result.trace[0].outcome).toBe("discarded_stale_screen");
	expect(phone.taps).toBe(0);
});

test("a phone action returning 503 is not replayed", async () => {
	const { phone, robot } = fixture();
	robot.tap = async () => { phone.taps++; throw unavailable(); };
	const result = await runJev(robot, { device: "retry-device-error", goal: "Search" }, {
		evaluate: (async ({ questions }: any) => answer(questions, "TAP")) as any,
	});
	expect(result.status).toBe("error");
	expect(phone.taps).toBe(1);
	expect(result.calls).toHaveLength(1);
	expect(result.trace[0].outcome).toBe("attempted");
});
