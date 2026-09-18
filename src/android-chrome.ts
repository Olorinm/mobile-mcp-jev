// Chrome's Android accessibility bridge may omit an otherwise visible web tree.
// Read that tree over the device's local DevTools socket, without changing pages.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { ActionableError, ScreenElement, ScreenElementRect } from "./robot";

const exec = promisify(execFile);
type Target = { id: string; type: string; webSocketDebuggerUrl: string };
type AXNode = { ignored: boolean; backendDOMNodeId?: number; role?: { value: string }; name?: { value: string };
	value?: { value: string }; properties?: { name: string; value: { value: unknown } }[] };

class Connection {
	private next = 0;
	private pending = new Map<number, { resolve: (result: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
	private constructor(private socket: WebSocket) {
		socket.addEventListener("message", event => {
			const response = JSON.parse(String(event.data));
			const request = this.pending.get(response.id);
			if (!request) { return; }
			clearTimeout(request.timer); this.pending.delete(response.id);
			if (response.error) { request.reject(new Error("Chrome protocol request failed")); } else { request.resolve(response.result); }
		});
		socket.addEventListener("close", () => this.rejectPending());
		socket.addEventListener("error", () => this.rejectPending());
	}
	static async open(url: string): Promise<Connection> {
		const socket = new WebSocket(url);
		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => { socket.close(); reject(new Error("Chrome connection timed out")); }, 2500);
			socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
			socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Chrome connection unavailable")); }, { once: true });
		});
		return new Connection(socket);
	}
	send(method: string, params: object = {}, timeoutMs = 3000): Promise<any> {
		return new Promise((resolve, reject) => {
			const id = ++this.next;
			const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Chrome ${method} request timed out`)); }, timeoutMs);
			this.pending.set(id, { resolve, reject, timer });
			this.socket.send(JSON.stringify({ id, method, params }));
		});
	}
	private rejectPending() { for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error("Chrome connection closed")); } this.pending.clear(); }
	close() { this.rejectPending(); this.socket.close(); }
}

// Executed against observed DOM nodes. Hit testing excludes controls covered by
// dialogs, as well as offscreen, hidden, or detached controls.
const geometry = `function () {
 const element = this.nodeType === 1 ? this : this.parentElement;
 if (!element || !element.isConnected) return null;
 const style = getComputedStyle(element);
 if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return null;
 let r;
 if (this.nodeType === 3) { const range = document.createRange(); range.selectNodeContents(this); r = range.getBoundingClientRect(); }
 else r = element.getBoundingClientRect();
 const v = visualViewport;
 const left = Math.max(r.left, v.offsetLeft), top = Math.max(r.top, v.offsetTop);
 const right = Math.min(r.right, v.offsetLeft + v.width), bottom = Math.min(r.bottom, v.offsetTop + v.height);
 if (right <= left || bottom <= top) return null;
 const x = (left + right) / 2, y = (top + bottom) / 2;
 const hit = document.elementFromPoint(x, y);
 if (!hit || !(element === hit || element.contains(hit) || hit.contains(element))) return null;
 return {x:left-v.offsetLeft,y:top-v.offsetTop,width:right-left,height:bottom-top,
   tapX:x,tapY:y,scale:devicePixelRatio*v.scale,viewportHeight:v.height,
   editable:element.matches('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]),textarea,[contenteditable=true]')};
}`;

export function webElementType(role: string): string {
	if (["textbox", "searchbox", "combobox", "spinbutton"].includes(role)) { return "EditText"; }
	return ["button", "link", "tab", "menuitem", "option", "checkbox", "radio", "switch"].includes(role) ? "Button" : "TextView";
}

export class AndroidChrome {
	private serial?: string;
	private activeId?: string;
	private knownRefs = new Set<string>();
	constructor(private device: string) {}
	private async adb(args: string[], serial?: string): Promise<string> {
		const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
		const binary = sdk ? join(sdk, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb") : "adb";
		return (await exec(binary, [...(serial ? ["-s", serial] : []), ...args], { timeout: 5000, windowsHide: true, maxBuffer: 1024 * 1024 })).stdout.trim();
	}
	private async resolveSerial(): Promise<string> {
		if (this.serial) { return this.serial; }
		const devices = (await this.adb(["devices"])).split(/\r?\n/).map(line => line.match(/^(\S+)\s+device$/)?.[1]).filter((s): s is string => !!s);
		for (const serial of devices) {
			if (serial === this.device || (serial.startsWith("emulator-") && (await this.adb(["emu", "avd", "name"], serial)).split(/\r?\n/)[0].trim() === this.device)) {
				return this.serial = serial;
			}
		}
		throw new Error("Device is not available through local ADB");
	}
	private async withPage<T>(run: (connection: Connection, target: Target) => Promise<T>, requiredId?: string): Promise<T> {
		const serial = await this.resolveSerial();
		const port = await this.adb(["forward", "tcp:0", "localabstract:chrome_devtools_remote"], serial);
		if (!/^\d+$/.test(port)) { throw new Error("Invalid Chrome forwarding port"); }
		try {
			const targets: Target[] = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(3000) })).json();
			const pages = targets.filter(t => t.type === "page" && (!requiredId || t.id === requiredId));
			pages.sort((a, b) => Number(b.id === this.activeId) - Number(a.id === this.activeId) || b.id.localeCompare(a.id, undefined, { numeric: true }));
			for (const page of pages) {
				const url = new URL(page.webSocketDebuggerUrl);
				if (!/^\/devtools\/page\/[A-Za-z0-9_-]+$/.test(url.pathname)) { continue; }
				const c = await Connection.open(`ws://127.0.0.1:${port}${url.pathname}`);
				try {
					let state;
					// Background Android tabs may be frozen and never execute JavaScript.
					try { state = await c.send("Runtime.evaluate", { expression: "document.visibilityState", returnByValue: true, timeout: 300 }, 400); } catch { continue; }
					if (state.result.value !== "visible") { continue; }
					this.activeId = page.id;
					return await run(c, page);
				} finally { c.close(); }
			}
			throw new Error("No visible Chrome page");
		} finally { await this.adb(["forward", "--remove", `tcp:${port}`], serial).catch(() => {}); }
	}
	async read(surface: ScreenElementRect): Promise<ScreenElement[]> {
		this.knownRefs.clear();
		return this.withPage(async (c, page) => {
			await c.send("Accessibility.enable");
			const tree: { nodes: AXNode[] } = await c.send("Accessibility.getFullAXTree");
			const candidates = tree.nodes.filter(n => !n.ignored && n.backendDOMNodeId && (n.name?.value || ["textbox", "searchbox", "combobox"].includes(n.role?.value || "")));
			if (candidates.length > 2500) { throw new Error("Web accessibility tree exceeds observation limit"); }
			const elements: ScreenElement[] = [];
			// Bound concurrent protocol requests on large pages.
			for (let offset = 0; offset < candidates.length; offset += 40) {
				const batch = await Promise.all(candidates.slice(offset, offset + 40).map(async n => {
					try {
						const node = await c.send("DOM.resolveNode", { backendNodeId: n.backendDOMNodeId, objectGroup: "mobile-observation" });
						if (!node.object.objectId) { return undefined; }
						const measured = await c.send("Runtime.callFunctionOn", { objectId: node.object.objectId, functionDeclaration: geometry, returnByValue: true });
						const r = measured.result.value;
						if (!r || n.role?.value === "RootWebArea") { return undefined; }
						const role = n.role?.value || "";
						const type = r.editable ? "EditText" : webElementType(role) === "EditText" ? "Button" : webElementType(role);
						const props = Object.fromEntries((n.properties || []).map(p => [p.name, p.value.value]));
						const ref = `cdp:${page.id}:${n.backendDOMNodeId}`;
						this.knownRefs.add(ref);
						return { ref, type, role, label: n.name?.value || "", value: n.value?.value === undefined ? undefined : String(n.value.value),
							identifier: `chrome-web:${page.id}:${n.backendDOMNodeId}`, clickable: type !== "TextView", enabled: props.disabled !== true,
							checked: props.checked === undefined ? undefined : props.checked === true || props.checked === "true", selected: props.selected === true,
							expanded: props.expanded === undefined ? undefined : props.expanded === true,
							rect: { x: Math.round(surface.x + r.x * r.scale), y: Math.round(surface.y + r.y * r.scale), width: Math.round(r.width * r.scale), height: Math.round(r.height * r.scale) } } satisfies ScreenElement;
					} catch { return undefined; }
				}));
				elements.push(...batch.filter((e): e is NonNullable<typeof e> => !!e));
			}
			return elements;
		});
	}
	async activate(ref: string, text?: string, holdMs = 0): Promise<void> {
		if (!this.knownRefs.has(ref)) { throw new ActionableError("Web control reference is stale; read the screen again."); }
		const match = /^cdp:([A-Za-z0-9_-]+):(\d+)$/.exec(ref);
		if (!match) { throw new ActionableError("Invalid web control reference."); }
		await this.withPage(async c => {
			const node = await c.send("DOM.resolveNode", { backendNodeId: Number(match[2]) });
			const measured = await c.send("Runtime.callFunctionOn", { objectId: node.object.objectId, functionDeclaration: geometry, returnByValue: true });
			const r = measured.result.value;
			if (!r || (text !== undefined && !r.editable)) { throw new ActionableError("Web control is no longer visible or editable; read the screen again."); }
			await c.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: r.tapX, y: r.tapY }] });
			if (holdMs) { await new Promise(resolve => setTimeout(resolve, holdMs)); }
			await c.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
			if (text !== undefined) { await c.send("Input.insertText", { text }); }
		}, match[1]);
	}
}
