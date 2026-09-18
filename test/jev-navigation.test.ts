import { test, expect } from "@playwright/test";
import { appChoices, decisionState, runJev } from "../src/jev";
import { InstalledApp, Robot } from "../src/robot";

const alpha = { appName: "Alpha", packageName: "com.example.alpha" };
const beta = { appName: "Beta", packageName: "com.example.beta" };
let previousKey: string | undefined;
test.beforeEach(() => { previousKey = process.env.AI_GATEWAY_API_KEY; process.env.AI_GATEWAY_API_KEY = "navigation-test-placeholder"; });
test.afterEach(() => { if (previousKey === undefined) { delete process.env.AI_GATEWAY_API_KEY; } else { process.env.AI_GATEWAY_API_KEY = previousKey; } });

function fixture(operations: string[], invalidAppTarget = false) {
	const phone = { foreground: alpha, installed: [alpha, beta] as InstalledApp[], actions: [] as unknown[][], revision: 0, discoveries: 0, requests: [] as any[] };
	const action = (...args: unknown[]) => { phone.actions.push(args); phone.revision++; };
	const robot = {
		listApps: async () => { phone.discoveries++; return phone.installed; },
		getForegroundApp: async () => phone.foreground,
		getElementsOnScreen: async () => [{ type: "Button", label: `Item ${phone.revision}`, enabled: true, clickable: true, rect: { x: 10, y: 20, width: 100, height: 60 } }],
		launchApp: async (pkg: string) => { phone.foreground = phone.installed.find(app => app.packageName === pkg)!; action("launch", pkg); },
		pressButton: async (key: string) => { if (key === "HOME") { phone.foreground = { appName: "Launcher", packageName: "com.example.launcher" }; } action("button", key); },
		swipe: async (direction: string) => action("swipe", direction),
		longPress: async (...args: unknown[]) => action("longPress", ...args),
		tap: async (...args: unknown[]) => action("tap", ...args),
	} as unknown as Robot;
	const evaluate = async (request: any) => {
		phone.requests.push(request);
		const operation = operations.shift() ?? "BLOCKED";
		return { answers: Object.fromEntries(Object.entries(request.questions).map(([key, q]: [string, any]) => {
			const choice = key === "operation" ? operation : key === "app_target" && invalidAppTarget ? "invented.package" : Object.keys(q.criteria)[0];
			return [key, { type: "choice", choice, probabilities: Object.fromEntries(Object.keys(q.criteria).map(id => [id, id === choice ? 1 : 0])) }];
		})), usage: { inputTokens: 1, outputTokens: 1 } };
	};
	const run = (beforeAction?: (progress: any) => Promise<void>) => runJev(robot, { device: "navigation-test", goal: "Open another application", maxSteps: 8, debug: { beforeAction } }, { evaluate: evaluate as any });
	return { phone, robot, run };
}

test("launch selects an observed app in the same evaluation and records foreground progress", async () => {
	const { phone, run } = fixture(["LAUNCH_APP", "DONE"]);
	const result = await run();
	expect(result.status).toBe("reported_complete");
	expect(phone.requests).toHaveLength(2);
	expect(phone.requests[0].questions.app_target.criteria).toEqual({ app2: '"Beta" (com.example.beta)' });
	expect(phone.requests[0].state.foregroundApp.packageName).toBe(alpha.packageName);
	expect(phone.requests[0].state.availableApps).toEqual(appChoices([alpha, beta]));
	expect(phone.actions).toEqual([["launch", beta.packageName]]);
	expect(phone.discoveries).toBe(2);
	expect(result.trace[0].apps).toEqual([{ ...beta, id: "app2" }]);
	expect(result.trace[0].screenChanged).toBe(true);
	expect(result.finalScreen.foregroundApp?.packageName).toBe(beta.packageName);
	expect(phone.requests[1].questions.app_target.criteria).toEqual({ app1: '"Alpha" (com.example.alpha)' });
	expect(decisionState("Continue", result.finalScreen, result.trace).recentActions[0].screenChanged).toBe(true);
});

test("invented application target cannot launch a package", async () => {
	const { phone, run } = fixture(["LAUNCH_APP"], true);
	const result = await run();
	expect(result.status).toBe("error");
	expect(phone.actions).toHaveLength(0);
});

test("an app removed during manual review is discarded without launching it", async () => {
	const { phone, run } = fixture(["LAUNCH_APP", "BLOCKED"]);
	const result = await run(async () => { phone.installed = [alpha]; });
	expect(result.trace[0].outcome).toBe("discarded_unavailable_app");
	expect(phone.actions).toHaveLength(0);
	expect(phone.requests[1].questions.operation.criteria.LAUNCH_APP).toBeUndefined();
});

test("home, horizontal swipes and long press execute only their selected operation", async () => {
	const { phone, run } = fixture(["HOME", "SWIPE_LEFT", "SWIPE_RIGHT", "LONG_PRESS", "DONE"], true);
	const result = await run();
	expect(result.status).toBe("reported_complete");
	expect(phone.actions).toEqual([["button", "HOME"], ["swipe", "left"], ["swipe", "right"], ["longPress", 60, 50, 500]]);
});

test("foreground changes invalidate navigation even when the controls look identical", async () => {
	const { phone, run } = fixture(["HOME", "BLOCKED"]);
	const result = await run(async () => { phone.foreground = beta; });
	expect(result.trace[0].outcome).toBe("discarded_stale_screen");
	expect(phone.actions).toHaveLength(0);
});

test("terminal decisions are rechecked against the current foreground", async () => {
	const { phone, robot, run } = fixture(["DONE", "BLOCKED"]);
	let reads = 0;
	robot.getForegroundApp = async () => ++reads === 1 ? alpha : beta;
	const result = await run();
	expect(result.status).toBe("blocked");
	expect(result.trace[0].outcome).toBe("discarded_stale_screen");
	expect(phone.actions).toHaveLength(0);
});

test("discovery failure leaves UI navigation usable and no launch choice", async () => {
	const { phone, robot, run } = fixture(["HOME", "DONE"]);
	robot.listApps = async () => { throw new Error("Unavailable"); };
	const result = await run();
	expect(result.status).toBe("reported_complete");
	expect(result.appInventory).toBe("unavailable");
	expect(phone.requests[0].questions.operation.criteria.LAUNCH_APP).toBeUndefined();
	expect(phone.actions).toEqual([["button", "HOME"]]);
});

test("app inventory deduplicates packages and rejects malformed launch parameters", () => {
	expect(appChoices([beta, alpha, beta, { appName: "Invalid", packageName: "com.example;bad" }])).toEqual([
		{ ...alpha, id: "app1" }, { ...beta, id: "app2" },
	]);
});
