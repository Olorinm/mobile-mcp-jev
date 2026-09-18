import { test, expect } from "@playwright/test";
import { Mobilecli } from "../src/mobilecli";

function cli() {
	const instance = new Mobilecli();
	(instance as any).path = process.execPath;
	return instance;
}

test("a slow screenshot subprocess leaves the event loop responsive", async () => {
	let finished = false;
	const image = cli().executeCommandBufferAsync(["-e", "setTimeout(() => process.stdout.write('frame'), 150)"]).then(buffer => {
		finished = true;
		return buffer;
	});
	await new Promise(resolve => setTimeout(resolve, 10));
	expect(finished).toBe(false);
	expect((await image).toString()).toBe("frame");
});

test("cancelling screenshot acquisition terminates the subprocess", async () => {
	const controller = new AbortController();
	const image = cli().executeCommandBufferAsync(["-e", "setInterval(() => {}, 1000)"], controller.signal);
	const rejection = expect(image).rejects.toMatchObject({ name: "AbortError" });
	controller.abort();
	await rejection;
});
