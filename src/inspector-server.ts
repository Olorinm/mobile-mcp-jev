import express from "express";
import { join } from "node:path";
import { z } from "zod";
import { Mobilecli } from "./mobilecli";
import { MobileDevice } from "./mobile-device";
import { InspectorSession } from "./inspector";

const taskSchema = z.object({ device: z.string().min(1).max(200), goal: z.string().trim().min(1).max(4000),
	app: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/).optional(), texts: z.array(z.string().min(1).max(2000)).max(20).optional(),
	maxSteps: z.number().int().min(1).max(40).default(16), timeoutMs: z.number().int().min(1000).max(300000).default(300000), automatic: z.boolean().default(false) });

export function createInspectorApp(options: { port: number; session?: InspectorSession; devices?: () => { id: string; name: string; state: string }[]; hasKey?: () => boolean }) {
	const app = express();
	const session = options.session ?? new InspectorSession(device => new MobileDevice(device));
	const devices = options.devices ?? (() => new Mobilecli().getDevices({ platform: "android" }).data.devices.filter(d => d.state === "online").map(({ id, name, state }) => ({ id, name, state })));
	const hasKey = options.hasKey ?? (() => Boolean(process.env.AI_GATEWAY_API_KEY));
	const hosts = new Set([`127.0.0.1:${options.port}`, `localhost:${options.port}`]);
	app.disable("x-powered-by");
	app.use((req, res, next) => {
		res.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
			"Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
		const host = req.get("host");
		if (!host || !hosts.has(host) || (req.get("origin") && req.get("origin") !== `http://${host}`)) { res.status(403).json({ error: "local_origin_required" }); return; }
		if (req.method !== "GET" && (req.get("X-Jev-Inspector") !== "1" || !req.is("application/json"))) { res.status(403).json({ error: "local_request_required" }); return; }
		next();
	});
	app.use(express.json({ limit: "32kb" }));
	const sendState = () => ({ ...session.state, hasKey: hasKey() });
	app.get("/api/state", (_req, res) => { res.json(sendState()); });
	app.get("/api/devices", (_req, res) => {
		try { res.json({ devices: devices(), preferredDevice: process.env.MOBILE_DEVICE }); } catch { res.status(503).json({ error: "device_unavailable" }); }
	});
	app.get("/api/events", (req, res) => {
		res.set({ "Content-Type": "text/event-stream", "Connection": "keep-alive" });
		res.flushHeaders();
		const send = () => { res.write(`data: ${JSON.stringify(sendState())}\n\n`); };
		send();
		session.on("update", send);
		const heartbeat = setInterval(() => res.write(": keepalive\n\n"), 15000);
		req.on("close", () => { clearInterval(heartbeat); session.off("update", send); });
	});
	app.post("/api/preview", async (req, res) => {
		const parsed = z.object({ device: z.string().min(1).max(200) }).safeParse(req.body);
		if (!parsed.success) { res.status(400).json({ error: "invalid_request" }); return; }
		try {
			if (!devices().some(d => d.id === parsed.data.device && d.state === "online")) { res.status(400).json({ error: "device_unavailable" }); return; }
			await session.preview(parsed.data.device); res.json(sendState());
		} catch { res.status(409).json({ error: "busy" }); }
	});
	app.post("/api/start", (req, res) => {
		const parsed = taskSchema.safeParse(req.body);
		if (!parsed.success) { res.status(400).json({ error: "invalid_request" }); return; }
		if (!hasKey()) { res.status(400).json({ error: "missing_key" }); return; }
		try {
			if (!devices().some(d => d.id === parsed.data.device && d.state === "online")) { res.status(400).json({ error: "device_unavailable" }); return; }
			res.json({ runId: session.start(parsed.data) });
		} catch { res.status(409).json({ error: "busy" }); }
	});
	app.post("/api/control", (req, res) => {
		const parsed = z.object({ runId: z.string(), command: z.enum(["step", "resume", "pause", "stop"]), step: z.number().int().optional() }).safeParse(req.body);
		if (!parsed.success) { res.status(400).json({ error: "invalid_request" }); return; }
		try { session.control(parsed.data.runId, parsed.data.command, parsed.data.step); res.json(sendState()); } catch { res.status(409).json({ error: "stale_decision" }); }
	});
	const assets = join(__dirname, "../inspector");
	for (const [route, file] of [["/", "index.html"], ["/app.js", "app.js"], ["/styles.css", "styles.css"]]) {
		app.get(route, (_req, res) => { res.sendFile(join(assets, file)); });
	}
	app.use((_req, res) => { res.status(404).json({ error: "not_found" }); });
	app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(400).json({ error: "invalid_request" }); });
	return { app, session };
}
