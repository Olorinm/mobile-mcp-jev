import { test, expect } from "@playwright/test";
import { snapshot, questionsFor, validChoice, runJev, activeJevDevices, decisionState } from "../src/jev";
import { flattenAndroidHierarchy } from "../src/mobile-device";
import { Robot } from "../src/robot";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/server";

const rect = { x: 0, y: 200, width: 200, height: 60 };
test("discarded input is audited but never presented as an executed action", () => {
	const screen = snapshot([]);
	const state = decisionState("Search", screen, [
		{ step: 0, screen, action: { operation: "TAP", target: "e1" }, outcome: "executed" },
		{ step: 1, screen, action: { operation: "TYPE", text: "Battery saver" }, outcome: "discarded_stale_screen" },
	]);
	expect(state.recentActions).toHaveLength(1);
	expect(state.recentActions[0].action.operation).toBe("TAP");
	expect(JSON.stringify(state)).not.toContain("Battery saver");
});
test("Android targets preserve switch state, ignore headings and offscreen rows", () => {
	const raw = [{ class: "android.widget.LinearLayout", clickable: true, enabled: true, rect,
		children: [{ class: "android.widget.TextView", text: "Dark theme", rect },
			{ "class": "android.widget.Switch", "content-desc": "Dark theme", "clickable": true, "checkable": true, "checked": true, rect }] },
	{ class: "android.widget.TextView", text: "Appearance", clickable: false, rect },
	{ class: "android.widget.TextView", text: "Hidden item", visible: false, clickable: true, rect }];
	const screen = snapshot(flattenAndroidHierarchy(raw));
	expect(screen.elements.find(e => e.type === "Switch")?.checked).toBe(true);
	const q = questionsFor(screen);
	expect(Object.values(q.tap_target.criteria).join(" ")).toContain("Dark theme");
	expect(Object.values(q.tap_target.criteria).join(" ")).not.toContain("Appearance");
	expect(JSON.stringify(screen)).not.toContain("Hidden item");
	expect(q.type_target).toBeUndefined();
});

test("snapshot identity ignores ref renumbering and status clock but catches checked/position changes", () => {
	const element = { type: "Switch", label: "Dark theme", rect, ref: "@e1", checked: false };
	const a = snapshot([element]);
	expect(snapshot([{ ...element, ref: "@e8" }]).fingerprint).toBe(a.fingerprint);
	expect(snapshot([{ ...element, checked: true }]).fingerprint).not.toBe(a.fingerprint);
	expect(snapshot([{ ...element, rect: { ...rect, y: 300 } }]).fingerprint).not.toBe(a.fingerprint);
	expect(snapshot([element, { type: "TextView", text: "12:00", identifier: "com.android.systemui:id/clock", rect }]).fingerprint).toBe(a.fingerprint);
});

test("rejects invented choices and malformed probability distributions", () => {
	const q = { type: "choice" as const, instructions: "Choose", criteria: { tap: "Tap", done: "Done" } };
	expect(validChoice({ type: "choice", choice: "tap", probabilities: { tap: 0.9, done: 0.1 } }, q)).toBe("tap");
	for (const answer of [
		{ type: "choice", choice: "constructor", probabilities: { tap: 1, done: 0 } },
		{ type: "choice", choice: "tap", probabilities: { tap: 1 } },
		{ type: "choice", choice: "tap", probabilities: { tap: 0.2, done: 0.8 } },
		{ type: "choice", choice: "tap", probabilities: { tap: NaN, done: 0 } },
	]) { expect(() => validChoice(answer, q)).toThrow(); }
});

test("a cancelled run releases its lock and makes no device calls", async () => {
	const old = process.env.AI_GATEWAY_API_KEY;
	process.env.AI_GATEWAY_API_KEY = "unit-test-placeholder";
	const robot = { getElementsOnScreen: async () => { throw new Error("must not run"); } } as unknown as Robot;
	try {
		const result = await runJev(robot, { device: "test", goal: "test", signal: AbortSignal.abort() });
		expect(result.status).toBe("cancelled_or_timeout");
		expect(result.calls).toHaveLength(0);
		expect(result.verified).toBe(false);
		expect(activeJevDevices.has("test")).toBe(false);
	} finally {
		if (old === undefined) { delete process.env.AI_GATEWAY_API_KEY; } else { process.env.AI_GATEWAY_API_KEY = old; }
	}
});

test("Jev is opt-in and ordinary MCP operations cannot interrupt its device", async () => {
	const old = process.env.MOBILEMCP_ENABLE_JEV;
	const oldTelemetry = process.env.MOBILEMCP_DISABLE_TELEMETRY;
	process.env.MOBILEMCP_ENABLE_JEV = "1";
	process.env.MOBILEMCP_DISABLE_TELEMETRY = "1";
	const server = createMcpServer();
	const client = new Client({ name: "jev-test", version: "1" });
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	try {
		await server.connect(serverTransport);
		await client.connect(clientTransport);
		const tools = await client.listTools();
		const jev = tools.tools.find(t => t.name === "mobile_jev_run");
		expect(jev?.annotations?.openWorldHint).toBe(true);
		expect(jev?.annotations?.destructiveHint).toBe(true);
		activeJevDevices.add("busy-unit-device");
		const response = await client.callTool({ name: "mobile_click_on_screen_at_coordinates", arguments: { device: "busy-unit-device", x: 5, y: 5 } });
		expect(response.isError).toBe(true);
		expect(JSON.stringify(response.content)).toContain("Device is busy");
	} finally {
		activeJevDevices.delete("busy-unit-device");
		await client.close(); await server.close();
		if (old === undefined) { delete process.env.MOBILEMCP_ENABLE_JEV; } else { process.env.MOBILEMCP_ENABLE_JEV = old; }
		if (oldTelemetry === undefined) { delete process.env.MOBILEMCP_DISABLE_TELEMETRY; } else { process.env.MOBILEMCP_DISABLE_TELEMETRY = oldTelemetry; }
	}
});
