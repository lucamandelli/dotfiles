// Publishes this Pi session to the Herdr app: a `pi.session` label on the herdr-core terminal Pi runs in
// (provider, model, effort, context). The Herdr mods (session-card, session-header, quota-bar) read it live
// from `terminals()` for the focused terminal. Folder, branch and space come from Herdr itself.
// No-op outside herdr-core (no HC_TERMINAL_ID). Updates only when the value changes, never on a timer.
import { execFile } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const TERMINAL = process.env.HC_TERMINAL_ID;
const LABEL = "pi.session";
const DEBOUNCE_MS = 400;

export interface SessionInfo {
	provider: string; // Pi provider id: anthropic, openai, xai
	model: string; // model id
	effort: string; // off .. max
	pct: number | null; // context used, percent
	tokens: number | null; // context tokens used
	window: number | null; // context window, tokens
}

export function encodeSession(i: SessionInfo): string {
	return JSON.stringify({ p: i.provider, m: i.model, e: i.effort, c: i.pct === null ? null : Math.round(i.pct * 10) / 10, t: i.tokens, w: i.window });
}

export default function (pi: ExtensionAPI) {
	if (!TERMINAL) return;
	let ctx: ExtensionContext | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let published: string | undefined;

	const set = (value: string) => {
		if (value === published) return;
		published = value;
		execFile("hc", ["label", TERMINAL, `${LABEL}=${value}`], { timeout: 10_000 }, () => {});
	};

	const publish = () => {
		timer = undefined;
		const c = ctx;
		if (!c?.model) return;
		let usage: ReturnType<ExtensionContext["getContextUsage"]>;
		try {
			usage = c.getContextUsage();
		} catch {
			return; // stale context after a session replacement
		}
		set(
			encodeSession({
				provider: c.model.provider,
				model: c.model.id,
				effort: pi.getThinkingLevel(),
				pct: usage?.percent ?? null,
				tokens: usage?.tokens ?? null,
				window: usage?.contextWindow ?? c.model.contextWindow ?? null,
			}),
		);
	};
	const schedule = (c?: ExtensionContext) => {
		if (c) ctx = c;
		if (!timer) timer = setTimeout(publish, DEBOUNCE_MS);
		timer.unref?.();
	};

	pi.on("session_start", (_e, c) => {
		published = undefined;
		schedule(c);
	});
	for (const ev of ["model_select", "thinking_level_select", "turn_end", "message_end"] as const) pi.on(ev, (_e, c) => schedule(c));
	pi.on("session_shutdown", () => {
		if (timer) clearTimeout(timer);
		timer = undefined;
		published = undefined;
		execFile("hc", ["label", TERMINAL, `${LABEL}=`], { timeout: 5_000 }, () => {});
	});
}
