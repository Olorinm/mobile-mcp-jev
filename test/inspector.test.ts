import { test, expect } from "@playwright/test";
import { request } from "node:http";
import { InspectorSession, InspectorTask } from "../src/inspector";
import { createInspectorApp } from "../src/inspector-server";
import { activeJevDevices, runJev } from "../src/jev";
import { Robot } from "../src/robot";

const task: InspectorTask = { device: "inspector-test", goal: "Enable Dark theme", automatic: false, maxSteps: 4, timeoutMs: 5000 };
let previousKey: string | undefined;
test.beforeEach(() => { previousKey = process.env.AI_GATEWAY_API_KEY; process.env.AI_GATEWAY_API_KEY = "inspector-test-placeholder"; });
test.afterEach(() => { if (previousKey === undefined) { delete process.env.AI_GATEWAY_API_KEY; } else { process.env.AI_GATEWAY_API_KEY = previousKey; } });

function fixture() {
	const phone = { checked: false, taps: 0, calls: 0 };
	const robot = {
		getDetailedElementsOnScreen: async () => [{ type: "Switch", label: "Dark theme", enabled: true, clickable: true, checked: phone.checked, rect: { x: 20, y: 100, width: 200, height: 60 } }],
		getScreenSize: async () => ({ width: 720, height: 1280, scale: 1 }),
		getScreenshot: async () => Buffer.from("test-image"),
		tap: async () => { phone.taps++; phone.checked = true; },
	} as unknown as Robot;
	const evaluate = async ({ questions }: any) => {
		phone.calls++;
		return { answers: Object.fromEntries(Object.entries(questions).map(([key, q]: [string, any]) => {
			const choice = key === "operation" ? phone.checked ? "DONE" : "TAP" : Object.keys(q.criteria)[0];
			return [key, { type: "choice", choice, probabilities: Object.fromEntries(Object.keys(q.criteria).map(k => [k, k === choice ? 1 : 0])) }];
		})), usage: { inputTokens: 10, outputTokens: 1 }, providerMetadata: { gateway: { cost: "0.000001" } } };
	};
	const session = new InspectorSession(() => robot, (r, options) => runJev(r, options, { evaluate: evaluate as any }));
	return { phone, session, robot };
}

test("manual mode pauses before mutation and a step cannot be replayed", async () => {
	const { phone, session } = fixture();
	const id = session.start(task);
	await expect.poll(() => session.state.status).toBe("paused");
	expect(phone.taps).toBe(0);
	expect(phone.calls).toBe(1);
	const step = session.state.pendingStep;
	session.control(id, "step", step);
	expect(() => session.control(id, "step", step)).toThrow();
	await session.done;
	expect(phone.taps).toBe(1);
	expect(session.state.result?.status).toBe("reported_complete");
	expect(session.state.result?.verified).toBe(false);
});

test("a screen changed during review invalidates the proposed coordinates", async () => {
	const { phone, session } = fixture();
	const id = session.start(task);
	await expect.poll(() => session.state.status).toBe("paused");
	phone.checked = true;
	session.control(id, "step", session.state.pendingStep);
	await session.done;
	expect(phone.taps).toBe(0);
	expect(session.state.result?.trace[0].outcome).toBe("discarded_stale_screen");
});

test("stop releases a paused run and old run IDs cannot control a new task", async () => {
	const { phone, session } = fixture();
	const first = session.start(task);
	await expect.poll(() => session.state.status).toBe("paused");
	session.control(first, "stop");
	await session.done;
	expect(phone.taps).toBe(0);
	expect(session.state.result?.status).toBe("cancelled_or_timeout");
	expect(activeJevDevices.has(task.device)).toBe(false);
	const second = session.start(task);
	await expect.poll(() => session.state.status).toBe("paused");
	expect(() => session.control(first, "resume")).toThrow("stale_session");
	session.control(second, "stop"); await session.done;
});

test("review timeout aborts without executing a pending action", async () => {
	const { phone, session } = fixture();
	session.start({ ...task, timeoutMs: 1000 });
	await session.done;
	expect(phone.taps).toBe(0);
	expect(session.state.result?.status).toBe("cancelled_or_timeout");
	expect(activeJevDevices.has(task.device)).toBe(false);
});

test("automatic mode executes and preview/start are blocked while running", async () => {
	const { phone, session } = fixture();
	const id = session.start(task);
	await expect.poll(() => session.state.status).toBe("paused");
	await expect(session.preview(task.device)).rejects.toThrow("busy");
	expect(() => session.start(task)).toThrow("busy");
	session.control(id, "resume"); await session.done;
	expect(phone.taps).toBe(1);
	phone.checked = false;
	session.start({ ...task, automatic: true }); await session.done;
	expect(phone.taps).toBe(2);
});

test("local API blocks cross-origin and invalid requests and never serves local secrets", async () => {
	const { session } = fixture();
	const { app } = createInspectorApp({ port: 4781, session, devices: () => [{ id: task.device, name: "Test Android", state: "online" }], hasKey: () => true });
	const server = app.listen(0, "127.0.0.1");
	await new Promise<void>(resolve => server.once("listening", resolve));
	const port = (server.address() as { port: number }).port;
	const http = (path: string, body?: unknown, headers: Record<string, string> = {}) => new Promise<{ status: number; body: string }>((resolve, reject) => {
		const req = request({ hostname: "127.0.0.1", port, path, method: body === undefined ? "GET" : "POST", headers: { "Host": "127.0.0.1:4781", "Content-Type": "application/json", "X-Jev-Inspector": "1", ...headers } }, res => {
			let text = ""; res.on("data", chunk => { text += chunk; }); res.on("end", () => resolve({ status: res.statusCode!, body: text }));
		}); req.on("error", reject); req.end(body === undefined ? undefined : JSON.stringify(body));
	});
	try {
		expect((await http("/api/state", undefined, { Host: "attacker.test:4781" })).status).toBe(403);
		expect((await http("/api/start", task, { Origin: "https://attacker.test" })).status).toBe(403);
		expect((await http("/api/start", task, { "X-Jev-Inspector": "" })).status).toBe(403);
		expect((await http("/api/start", { ...task, maxSteps: 999 })).status).toBe(400);
		expect((await http("/api/start", { ...task, app: "com.example;bad" })).status).toBe(400);
		expect((await http("/.env")).status).toBe(404);
		expect((await http("/src/jev.ts")).status).toBe(404);
		const state = await http("/api/state");
		expect(state.status).toBe(200); expect(state.body).not.toContain("inspector-test-placeholder");
		expect((await http("/")).body).toContain("Jev Inspector");
	} finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
