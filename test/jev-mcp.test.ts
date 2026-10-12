import { test, expect } from "@playwright/test";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServer } from "../src/server";
import { Mobilecli } from "../src/mobilecli";
import { MobileDevice } from "../src/mobile-device";
import { activeJevDevices } from "../src/jev";

test("MCP cancellation stops Jev and releases the device after SDK v2 migration", async () => {
	const originalEnv = { enabled: process.env.MOBILEMCP_ENABLE_JEV, telemetry: process.env.MOBILEMCP_DISABLE_TELEMETRY, key: process.env.AI_GATEWAY_API_KEY };
	const originals = { devices: Mobilecli.prototype.getDevices, version: Mobilecli.prototype.getVersion,
		apps: MobileDevice.prototype.listApps, screen: MobileDevice.prototype.getDetailedElementsOnScreen,
		foreground: MobileDevice.prototype.getForegroundApp, fetch: globalThis.fetch };
	const device = "mcp-cancel-fixture";
	let releaseScreen!: () => void;
	const screenReady = new Promise<void>(resolve => { releaseScreen = resolve; });
	let requests = 0;
	process.env.MOBILEMCP_ENABLE_JEV = "1";
	process.env.MOBILEMCP_DISABLE_TELEMETRY = "1";
	process.env.AI_GATEWAY_API_KEY = "test-key";
	Mobilecli.prototype.getDevices = () => ({ status: "ok", data: { devices: [
		{ id: device, name: device, platform: "android", type: "emulator", state: "online", version: "15" },
	] } });
	Mobilecli.prototype.getVersion = () => "1.0.19";
	MobileDevice.prototype.listApps = async () => [];
	MobileDevice.prototype.getForegroundApp = async () => ({ appName: "Fixture", packageName: "org.example.fixture" });
	MobileDevice.prototype.getDetailedElementsOnScreen = async () => {
		await screenReady;
		return [{ type: "Button", label: "Fixture", rect: { x: 0, y: 0, width: 100, height: 100 } }];
	};
	globalThis.fetch = async () => { requests++; throw new Error("Unexpected network call"); };
	const server = createMcpServer();
	const client = new Client({ name: "jev-cancel-test", version: "1" });
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	const controller = new AbortController();
	try {
		await server.connect(serverTransport);
		await client.connect(clientTransport);
		const pending = client.callTool({ name: "mobile_jev_run", arguments: { device, goal: "Open Settings" } }, { signal: controller.signal });
		const rejected = expect(pending).rejects.toThrow();
		await expect.poll(() => activeJevDevices.has(device)).toBe(true);
		controller.abort();
		await rejected;
		releaseScreen();
		await expect.poll(() => activeJevDevices.has(device)).toBe(false);
		expect(requests).toBe(0);
	} finally {
		controller.abort(); releaseScreen();
		await client.close(); await server.close();
		Mobilecli.prototype.getDevices = originals.devices;
		Mobilecli.prototype.getVersion = originals.version;
		MobileDevice.prototype.listApps = originals.apps;
		MobileDevice.prototype.getDetailedElementsOnScreen = originals.screen;
		MobileDevice.prototype.getForegroundApp = originals.foreground;
		globalThis.fetch = originals.fetch;
		activeJevDevices.delete(device);
		if (originalEnv.enabled === undefined) { delete process.env.MOBILEMCP_ENABLE_JEV; } else { process.env.MOBILEMCP_ENABLE_JEV = originalEnv.enabled; }
		if (originalEnv.telemetry === undefined) { delete process.env.MOBILEMCP_DISABLE_TELEMETRY; } else { process.env.MOBILEMCP_DISABLE_TELEMETRY = originalEnv.telemetry; }
		if (originalEnv.key === undefined) { delete process.env.AI_GATEWAY_API_KEY; } else { process.env.AI_GATEWAY_API_KEY = originalEnv.key; }
	}
});
