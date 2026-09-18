import { expect, test } from "@playwright/test";
import { MobileDevice } from "../src/mobile-device";
import { AndroidChrome } from "../src/android-chrome";

const rect = { x: 0, y: 240, width: 720, height: 900 };
function deviceWithPage(children: any[] = []) {
	const device = new MobileDevice("test");
	const raw = { hierarchy: [{ class: "android.widget.FrameLayout", rect, children: [
		{ "class": "android.widget.EditText", "resource-id": "com.android.chrome:id/url_bar", "text": "example.test", "clickable": true, rect },
		{ class: "android.webkit.WebView", text: "Example", rect, children },
	] }] };
	(device as any).mobilecli.executeCommand = () => JSON.stringify({ data: { rawData: JSON.stringify(raw) } });
	device.getForegroundApp = async () => ({ packageName: "com.android.chrome", appName: "Chrome" });
	return { device, raw };
}

test("empty web wrappers use the visible-page fallback and discard the placeholder", async () => {
	const { device } = deviceWithPage([{ class: "android.view.View", rect, children: [] }]);
	let reads = 0;
	(device as any).chrome.read = async () => { reads++; return [{ type: "EditText", label: "Destination", ref: "cdp:1:12", rect }]; };
	const controls = await device.getDetailedElementsOnScreen();
	expect(reads).toBe(1);
	expect(controls.map(e => e.label)).toContain("Destination");
	expect(controls.some(e => e.type === "android.webkit.WebView")).toBe(false);
});

test("a missing web tree stops observation instead of offering only the address bar", async () => {
	const { device } = deviceWithPage();
	(device as any).chrome.read = async () => [];
	await expect(device.getDetailedElementsOnScreen()).rejects.toThrow("webpage controls are unavailable");
});

test("a loading page can settle before its web controls become available", async () => {
	const { device } = deviceWithPage();
	let reads = 0;
	(device as any).chrome.read = async () => ++reads < 4 ? [] : [{ type: "Button", label: "Search", ref: "cdp:1:12", rect }];
	const controls = await device.getDetailedElementsOnScreen();
	expect(reads).toBe(4);
	expect(controls.some(e => e.label === "Search")).toBe(true);
});

test("native content and a focused omnibox do not require DevTools", async () => {
	const { device, raw } = deviceWithPage([{ class: "android.widget.Button", text: "Continue", clickable: true, rect }]);
	(device as any).chrome.read = async () => { throw new Error("must not query web page"); };
	expect((await device.getDetailedElementsOnScreen()).some(e => e.label === "Continue")).toBe(true);
	(raw.hierarchy[0].children[0] as any).focused = true;
	raw.hierarchy[0].children[1].children = [];
	await expect(device.getDetailedElementsOnScreen()).resolves.toBeDefined();
});

test("a different foreground application never activates underlying Chrome controls", async () => {
	const { device } = deviceWithPage();
	device.getForegroundApp = async () => ({ packageName: "com.android.permissioncontroller", appName: "Permissions" });
	(device as any).chrome.read = async () => { throw new Error("must not query covered page"); };
	await expect(device.getDetailedElementsOnScreen()).resolves.toBeDefined();
});

test("unknown or newly occluded web references cannot dispatch input", async () => {
	const chrome = new AndroidChrome("test");
	await expect(chrome.activate("cdp:1:2")).rejects.toThrow("stale");
	(chrome as any).knownRefs.add("cdp:1:2");
	const calls: string[] = [];
	(chrome as any).withPage = async (run: any) => run({ send: async (method: string) => {
		calls.push(method);
		if (method === "DOM.resolveNode") { return { object: { objectId: "node" } }; }
		if (method === "Runtime.callFunctionOn") { return { result: { value: null } }; }
		throw new Error("must not dispatch input");
	} });
	await expect(chrome.activate("cdp:1:2", "hello")).rejects.toThrow("no longer visible");
	expect(calls.some(method => method.startsWith("Input."))).toBe(false);
});
