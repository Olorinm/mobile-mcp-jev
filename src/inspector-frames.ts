/** One screenshot at a time, independent of decision/action progress. */
export class InspectorFrames {
	private controller = new AbortController();
	private timer?: ReturnType<typeof setTimeout>;
	private inFlight: Promise<void> = Promise.resolve();
	private finishing = false;

	constructor(private capture: (signal: AbortSignal) => Promise<void>, private intervalMs = 500) { }

	public start() {
		this.inFlight = this.capture(this.controller.signal).catch(() => {}).then(() => {
			if (!this.finishing && !this.controller.signal.aborted) {
				this.timer = setTimeout(() => this.start(), this.intervalMs);
				this.timer.unref();
			}
		});
	}

	/** Refresh the final view without extending the task's clock or holding its lock. */
	public finish(): Promise<void> {
		this.finishing = true;
		clearTimeout(this.timer);
		this.inFlight = this.inFlight.then(async () => {
			if (!this.controller.signal.aborted) { await this.capture(this.controller.signal); }
		}).catch(() => {});
		return this.inFlight;
	}

	public stop() {
		this.finishing = true;
		clearTimeout(this.timer);
		this.controller.abort();
	}
}
