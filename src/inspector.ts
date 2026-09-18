import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { activeJevDevices, JevProgress, runJev, snapshot, Snapshot } from "./jev";
import { Robot } from "./robot";

export type InspectorTask = { device: string; goal: string; app?: string; texts?: string[]; maxSteps: number; timeoutMs: number; automatic: boolean };
type Frame = { data: string; width: number; height: number; capturedAt: number; screen: Snapshot };
export type InspectorState = {
	runId: string; status: "idle" | "previewing" | "starting" | "running" | "paused" | "stopping" | "finished" | "error";
	automatic: boolean; device?: string; goal?: string; pendingStep?: number; progress?: JevProgress;
	frame?: Frame; imageError?: boolean; result?: Awaited<ReturnType<typeof runJev>>; error?: string;
};

/** A single local debug session. Device work is serialized; approval is one-use. */
export class InspectorSession extends EventEmitter {
	public state: InspectorState = { runId: "", status: "idle", automatic: false };
	public done: Promise<void> = Promise.resolve();
	private controller?: AbortController;
	private release?: () => void;
	private busy = false;

	constructor(private robotFor: (device: string) => Robot, private runner: typeof runJev = runJev) { super(); }

	private publish() { this.emit("update", this.state); }

	private async capture(robot: Robot, screen: Snapshot) {
		try {
			const size = await robot.getScreenSize();
			const data = await robot.getScreenshot({ format: "jpeg", quality: 75, maxSize: 720 });
			this.state.frame = { data: `data:image/jpeg;base64,${data.toString("base64")}`, width: size.width, height: size.height, capturedAt: Date.now(), screen: structuredClone(screen) };
			this.state.imageError = false;
		} catch { this.state.imageError = true; this.state.frame = undefined; }
	}

	public async preview(device: string) {
		if (this.busy || activeJevDevices.has(device)) { throw new Error("busy"); }
		this.busy = true;
		this.state = { runId: "", status: "previewing", automatic: false, device };
		this.publish();
		try {
			const robot = this.robotFor(device);
			const screen = snapshot(await (robot.getDetailedElementsOnScreen?.() ?? robot.getElementsOnScreen()));
			await this.capture(robot, screen);
			this.state.status = "idle";
		} catch { this.state.status = "error"; this.state.error = "device_unavailable"; } finally { this.busy = false; this.publish(); }
	}

	public start(task: InspectorTask): string {
		if (this.busy || activeJevDevices.has(task.device)) { throw new Error("busy"); }
		this.busy = true;
		this.controller = new AbortController();
		this.state = { runId: randomUUID(), status: "starting", automatic: task.automatic, device: task.device, goal: task.goal };
		this.publish();
		this.done = this.execute(task, this.controller.signal);
		return this.state.runId;
	}

	private async execute(task: InspectorTask, signal: AbortSignal) {
		try {
			const robot = this.robotFor(task.device);
			if (task.app) { await robot.launchApp(task.app); }
			signal.throwIfAborted();
			this.state.status = "running";
			this.state.result = await this.runner(robot, { ...task, signal, debug: {
				onUpdate: async progress => {
					this.state.progress = structuredClone(progress);
					if (["observed", "decision", "executed", "finished"].includes(progress.phase)) { await this.capture(robot, progress.screen); }
					this.publish();
				},
				beforeAction: async (progress, actionSignal) => {
					actionSignal.throwIfAborted();
					if (this.state.automatic) { return; }
					this.state.pendingStep = progress.trace.at(-1)!.step;
					this.state.status = "paused";
					await new Promise<void>((resolve, reject) => {
						const cleanup = () => { this.release = undefined; actionSignal.removeEventListener("abort", abort); };
						const abort = () => { cleanup(); reject(actionSignal.reason); };
						this.release = () => { cleanup(); resolve(); };
						actionSignal.addEventListener("abort", abort, { once: true });
						this.publish();
					});
					this.state.pendingStep = undefined;
					this.state.status = "running";
				},
			} });
			this.state.status = "finished";
		} catch {
			this.state.status = "error";
			this.state.error = signal.aborted ? "stopped" : "run_failed";
		} finally {
			this.release = undefined;
			this.state.pendingStep = undefined;
			this.busy = false;
			this.publish();
		}
	}

	public control(runId: string, command: "step" | "resume" | "pause" | "stop", step?: number) {
		if (!this.busy || !runId || runId !== this.state.runId || this.state.status === "stopping") { throw new Error("stale_session"); }
		if (command === "step") {
			if (!this.release || this.state.status !== "paused" || step !== this.state.pendingStep) { throw new Error("stale_decision"); }
			const release = this.release;
			this.state.pendingStep = undefined;
			this.state.status = "running";
			release();
		} else if (command === "resume") {
			this.state.automatic = true;
			if (this.release) { this.state.status = "running"; this.state.pendingStep = undefined; this.release(); }
		} else if (command === "pause") { this.state.automatic = false; } else { this.state.status = "stopping"; this.controller?.abort(); }
		this.publish();
	}
}
