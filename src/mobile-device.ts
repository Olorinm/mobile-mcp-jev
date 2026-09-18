// Modified by mobile-mcp-jev: preserve Android UI attributes for Jev decisions.
import { Mobilecli } from "./mobilecli";
import { AndroidChrome } from "./android-chrome";
import { ActionableError, Button, InstalledApp, Orientation, Robot, ScreenElement, ScreenSize, ScreenshotOptions, SwipeDirection } from "./robot";

interface InstalledAppsResponse {
	status: "ok",
	data: Array<{
		packageName: string;
		appName?: string; // ios
		version?: string; // ios
	}>;
}

interface DeviceInfoResponse {
	status: "ok",
	data: {
		device: {
			id: string;
			name: string;
			platform: string;
			type: string;
			version: string;
			state: string;
			screenSize?: {
				width: number;
				height: number;
				scale: number;
			};
		};
	};
}

interface UIElementResponse {
	ref?: string;
	type: string;
	label?: string;
	text?: string;
	name?: string;
	value?: string;
	identifier?: string;
	rect: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	focused?: boolean;
	selected?: boolean;
	checked?: boolean;
	enabled?: boolean;
	children?: UIElementResponse[];
}

interface DumpUIResponse {
	status: "ok",
	data: {
		elements: UIElementResponse[];
	};
}

interface ForegroundAppResponse {
	status: "ok",
	data: {
		packageName: string;
		appName?: string;
	};
}

interface OrientationResponse {
	status: "ok",
	data: {
		orientation: Orientation;
	};
}

interface ClipboardResponse {
	data: {
		text: string;
	};
}

const flattenUIElement = (element: UIElementResponse): ScreenElement[] => {
	const screenElement: ScreenElement = {
		type: element.type,
		label: element.label,
		text: element.text,
		name: element.name,
		value: element.value,
		identifier: element.identifier,
		rect: element.rect,
		ref: element.ref,
		focused: element.focused,
		selected: element.selected,
		checked: element.checked,
		enabled: element.enabled,
	};

	if (!element.children) {
		return [screenElement];
	}

	return [screenElement, ...element.children.flatMap(child => flattenUIElement(child))];
};

interface AndroidNode {
	class: string;
	package?: string;
	focused?: boolean;
	text?: string;
	hint?: string;
	"content-desc"?: string;
	"resource-id"?: string;
	enabled?: boolean;
	checked?: boolean;
	checkable?: boolean;
	clickable?: boolean;
	visible?: boolean;
	selected?: boolean;
	rect: ScreenElement["rect"];
	children?: AndroidNode[];
}

export function flattenAndroidHierarchy(nodes: AndroidNode[]): ScreenElement[] {
	const result: ScreenElement[] = [];
	const labels = (node: AndroidNode): string[] => node.visible === false ? [] :
		[node.text, node["content-desc"], node.hint, ...(node.children ?? []).flatMap(labels)].filter((s): s is string => Boolean(s));
	const visit = (node: AndroidNode, insideClickable = false) => {
		if (node.visible === false || node.rect.width <= 0 || node.rect.height <= 0 || node["resource-id"]?.startsWith("com.android.systemui:")) { return; }
		const label = node.clickable ? [...new Set(labels(node))].join(" | ") : [node.text, node["content-desc"], node.hint].filter(Boolean).join(" | ");
		if (node.clickable || /EditText/.test(node.class) || (label && !insideClickable)) {
			result.push({ type: node.class, label, identifier: node["resource-id"], rect: node.rect, enabled: node.enabled,
				clickable: node.clickable === true, checked: node.checkable ? node.checked : undefined, selected: node.selected || undefined });
		}
		for (const child of node.children ?? []) { visit(child, insideClickable || node.clickable === true); }
	};
	for (const node of nodes) { visit(node); }
	return result;
}

export class MobileDevice implements Robot {
	private chrome: AndroidChrome;
	private chromeFallbackActive = false;
	public async getDetailedElementsOnScreen(): Promise<ScreenElement[]> {
		const response = this.runJsonCommand<{ data: { rawData: string } }>(["dump", "ui", "--format", "raw"]);
		const raw = JSON.parse(response.data.rawData);
		if (!Array.isArray(raw.hierarchy)) { throw new Error("Detailed UI requires Android hierarchy"); }
		const roots: AndroidNode[] = raw.hierarchy;
		const all: AndroidNode[] = [];
		const visit = (node: AndroidNode) => { all.push(node); node.children?.forEach(visit); };
		roots.forEach(visit);
		const native = flattenAndroidHierarchy(roots);
		const chrome = all.filter(node => node.visible !== false);
		if (!chrome.some(node => node["resource-id"]?.startsWith("com.android.chrome:"))) { this.chromeFallbackActive = false; return native; }
		// Keep native dialogs/omnibox in charge while they cover the page.
		if (chrome.some(node => node["resource-id"] === "com.android.chrome:id/url_bar" && node.focused) ||
			chrome.some(node => /^android:id\/(alertTitle|button[123])$/.test(node["resource-id"] || ""))) { return native; }
		const surface = chrome.find(node => node.class === "android.webkit.WebView") ?? chrome.find(node => node["content-desc"] === "Web View");
		if (!surface || (!this.chromeFallbackActive && flattenAndroidHierarchy([surface]).length > 1)) { return native; }
		if ((await this.getForegroundApp()).packageName !== "com.android.chrome") { return native; }
		this.chromeFallbackActive = true;
		const toolbarBottom = chrome.filter(node => /\/(toolbar|toolbar_container)$/.test(node["resource-id"] || ""))
			.reduce((bottom, node) => Math.max(bottom, node.rect.y + node.rect.height), surface.rect.y);
		const rect = { ...surface.rect, y: toolbarBottom };
		const strip = (node: AndroidNode): AndroidNode | undefined => node === surface ? undefined :
			{ ...node, children: node.children?.map(strip).filter((child): child is AndroidNode => !!child) };
		// New documents may expose no controls during loading. Give them a
		// bounded settling window instead of returning only the browser toolbar.
		const deadline = performance.now() + 8000;
		for (let attempt = 0; ; attempt++) {
			try {
				const web = await this.chrome.read(rect);
				if (web.length) { return [...flattenAndroidHierarchy(roots.map(strip).filter((node): node is AndroidNode => !!node)), ...web]; }
			} catch { /* A transient page load may not have an accessibility tree yet. */ }
			if (attempt >= 2 && performance.now() >= deadline) { break; }
			await new Promise(resolve => setTimeout(resolve, 250));
		}
		throw new ActionableError("Chrome webpage controls are unavailable. Check the page and its local ADB/DevTools connection before continuing.");
	}

	private mobilecli: Mobilecli;

	public constructor(private deviceId: string) {
		this.mobilecli = new Mobilecli();
		this.chrome = new AndroidChrome(deviceId);
	}

	private runCommand(args: string[]): string {
		const fullArgs = [...args, "--device", this.deviceId];
		// A disconnected device must not leave the agent waiting indefinitely.
		return this.mobilecli.executeCommand(fullArgs, 30000);
	}

	private runJsonCommand<T>(args: string[]): T {
		const output = this.runCommand(args);
		try {
			return JSON.parse(output) as T;
		} catch {
			throw new ActionableError(`Failed to parse JSON response from mobilecli ${args.join(" ")}`);
		}
	}

	public async getScreenSize(): Promise<ScreenSize> {
		const response = this.runJsonCommand<DeviceInfoResponse>(["device", "info"]);
		if (response.data.device.screenSize) {
			return response.data.device.screenSize;
		}
		return { width: 0, height: 0, scale: 1.0 };
	}

	public async swipe(direction: SwipeDirection): Promise<void> {
		const screenSize = await this.getScreenSize();
		const centerX = Math.floor(screenSize.width / 2);
		const centerY = Math.floor(screenSize.height / 2);
		const distance = 400; // Default distance in pixels

		let startX = centerX;
		let startY = centerY;
		let endX = centerX;
		let endY = centerY;

		switch (direction) {
			case "up":
				startY = centerY + distance / 2;
				endY = centerY - distance / 2;
				break;
			case "down":
				startY = centerY - distance / 2;
				endY = centerY + distance / 2;
				break;
			case "left":
				startX = centerX + distance / 2;
				endX = centerX - distance / 2;
				break;
			case "right":
				startX = centerX - distance / 2;
				endX = centerX + distance / 2;
				break;
		}

		this.runCommand(["io", "swipe", `${startX},${startY},${endX},${endY}`]);
	}

	public async swipeFromCoordinate(x: number, y: number, direction: SwipeDirection, distance?: number): Promise<void> {
		const swipeDistance = distance || 400;
		let endX = x;
		let endY = y;

		switch (direction) {
			case "up":
				endY = y - swipeDistance;
				break;
			case "down":
				endY = y + swipeDistance;
				break;
			case "left":
				endX = x - swipeDistance;
				break;
			case "right":
				endX = x + swipeDistance;
				break;
		}

		this.runCommand(["io", "swipe", `${Math.round(x)},${Math.round(y)},${Math.round(endX)},${Math.round(endY)}`]);
	}

	public async getScreenshot(options?: ScreenshotOptions): Promise<Buffer> {
		const format = options?.format || "png";
		const fullArgs = ["screenshot", "--device", this.deviceId, "--format", format, "--output", "-"];
		if (format === "jpeg" && options?.quality !== undefined) {
			fullArgs.push("--quality", `${options.quality}`);
		}

		if (options?.maxSize !== undefined) {
			fullArgs.push("--max-size", `${options.maxSize}`);
		}

		if (options?.scale !== undefined && options.scale !== 1) {
			fullArgs.push("--scale", `${options.scale}`);
		}

		return this.mobilecli.executeCommandBufferAsync(fullArgs, options?.signal);
	}

	public async listApps(): Promise<InstalledApp[]> {
		const response = this.runJsonCommand<InstalledAppsResponse>(["apps", "list"]);
		return response.data.map(app => ({
			appName: app.appName || app.packageName,
			packageName: app.packageName,
		})) as InstalledApp[];
	}

	public async getForegroundApp(): Promise<InstalledApp> {
		const response = this.runJsonCommand<ForegroundAppResponse>(["apps", "foreground"]);
		return {
			appName: response.data.appName || response.data.packageName,
			packageName: response.data.packageName,
		};
	}

	public async launchApp(packageName: string, locale?: string): Promise<void> {
		const args = ["apps", "launch", packageName];
		if (locale) {
			args.push("--locale", locale);
		}

		this.runCommand(args);
	}

	public async terminateApp(packageName: string): Promise<void> {
		this.runCommand(["apps", "terminate", packageName]);
	}

	public async installApp(path: string): Promise<void> {
		this.runCommand(["apps", "install", path]);
	}

	public async uninstallApp(bundleId: string): Promise<void> {
		this.runCommand(["apps", "uninstall", bundleId]);
	}

	public async openUrl(url: string): Promise<void> {
		this.runCommand(["url", url]);
	}

	public async sendKeys(text: string): Promise<void> {
		this.runCommand(["io", "text", text]);
	}

	public async pressButton(button: Button): Promise<void> {
		this.runCommand(["io", "button", button]);
	}

	public async tap(x: number, y: number): Promise<void> {
		// mobilecli rejects fractional coordinates ("x and y must be integers")
		this.runCommand(["io", "tap", `${Math.round(x)},${Math.round(y)}`]);
	}

	public async tapByRef(ref: string): Promise<void> {
		if (ref.startsWith("cdp:")) { await this.chrome.activate(ref); return; }
		this.runCommand(["io", "tap", ref]);
	}

	public async typeByRef(ref: string, text: string): Promise<void> {
		if (ref.startsWith("cdp:")) { await this.chrome.activate(ref, text); return; }
		await this.tapByRef(ref); await this.sendKeys(text);
	}

	public async longPressByRef(ref: string, duration: number): Promise<void> {
		if (ref.startsWith("cdp:")) { await this.chrome.activate(ref, undefined, duration); return; }
		this.runCommand(["io", "longpress", ref, "--duration", `${duration}`]);
	}

	public async doubleTap(x: number, y: number): Promise<void> {
		// TODO: should move into mobilecli itself as "io doubletap"
		await this.tap(x, y);
		await this.tap(x, y);
	}

	public async longPress(x: number, y: number, duration: number): Promise<void> {
		this.runCommand(["io", "longpress", `${Math.round(x)},${Math.round(y)}`, "--duration", `${duration}`]);
	}

	public async getElementsOnScreen(): Promise<ScreenElement[]> {
		const response = this.runJsonCommand<DumpUIResponse>(["dump", "ui"]);
		return response.data.elements.flatMap(element => flattenUIElement(element));
	}

	public async setOrientation(orientation: Orientation): Promise<void> {
		this.runCommand(["device", "orientation", "set", orientation]);
	}

	public async getOrientation(): Promise<Orientation> {
		const response = this.runJsonCommand<OrientationResponse>(["device", "orientation", "get"]);
		return response.data.orientation;
	}

	public async setLocation(latitude: number, longitude: number): Promise<void> {
		this.runCommand(["device", "location", "set", `${latitude},${longitude}`]);
	}

	public async clearLocation(): Promise<void> {
		this.runCommand(["device", "location", "clear"]);
	}

	public async getClipboard(): Promise<string> {
		const response = this.runJsonCommand<ClipboardResponse>(["io", "clipboard", "get"]);
		return response.data.text;
	}

	public async setClipboard(text: string): Promise<void> {
		this.runCommand(["io", "clipboard", "set", text]);
	}

	public getLogs(limit: number, filters: string[], timeoutMs: number): Promise<string> {
		const args = ["device", "logs", "--limit", String(limit), ...filters.flatMap(filter => ["--filter", filter]), "--device", this.deviceId];
		const child = this.mobilecli.spawnCommand(args, true);

		return new Promise((resolve, reject) => {
			const stdout: Buffer[] = [];
			const stderr: Buffer[] = [];
			let silenceTimer: NodeJS.Timeout;

			// kill the stream once no log entry arrived for timeoutMs, then return what was captured
			const restartSilenceTimer = () => {
				clearTimeout(silenceTimer);
				silenceTimer = setTimeout(() => child.kill(), timeoutMs);
			};

			child.stdout?.on("data", (chunk: Buffer) => {
				stdout.push(chunk);
				restartSilenceTimer();
			});

			child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));

			child.on("error", err => {
				clearTimeout(silenceTimer);
				reject(err);
			});

			child.on("close", code => {
				clearTimeout(silenceTimer);
				if (code !== 0 && !child.killed) {
					reject(new Error(`mobilecli device logs failed with code ${code}: ${Buffer.concat(stderr).toString().trim()}`));
					return;
				}

				resolve(Buffer.concat(stdout).toString().trim());
			});

			restartSilenceTimer();
		});
	}
}
