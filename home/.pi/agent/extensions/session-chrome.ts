// Session chrome: Pi logo header (replaces the [Skills]/[Extensions] listing; needs quietStartup: true)
// and a clean user prompt (accent chevron, no background box; pair with theme userMessageBg "").
// Header: public API (setHeader). User prompt: wraps private UserMessageComponent.prototype.render,
// installed on session_start, restored on session_shutdown, native render if anything looks different.
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { getAgentDir, keyHint, UserMessageComponent, VERSION } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

function extensionNames(): string[] {
	const names = new Set<string>();
	try {
		for (const f of readdirSync(join(getAgentDir(), "extensions"))) names.add(basename(f).replace(/\.(ts|js)$/, ""));
	} catch {}
	try {
		const s = JSON.parse(readFileSync(join(getAgentDir(), "settings.json"), "utf8"));
		for (const p of s.packages ?? []) names.add(String(typeof p === "string" ? p : p.source).replace(/^npm:/, "").replace(/^.*\//, ""));
	} catch {}
	const argv = process.argv;
	for (let i = 0; i < argv.length; i++)
		if (argv[i] === "-e" || argv[i] === "--extension") names.add(basename(argv[i + 1] ?? "").replace(/\.(ts|js)$/, ""));
	return [...names].filter(Boolean).sort();
}

const OSC = /^((?:\x1b\]133;[A-Z]\x07)*)/;
const STRIP = /\x1b\][^\x07]*\x07|\x1b\[[0-9;]*m/g;

// Patch state lives on globalThis so /reload (new module instance) and other packages wrapping the same
// prototype method cannot stack a second copy: the wrapper stays installed and is only switched on/off.
const KEY = Symbol.for("dotfiles.pi.session-chrome");
type State = { active: boolean; theme?: Theme; original?: Function; patched?: Function };
const state = ((globalThis as any)[KEY] ??= { active: false }) as State;

function uninstall() {
	state.active = false;
	const proto = UserMessageComponent?.prototype as any;
	if (proto && state.patched && proto.render === state.patched && state.original) {
		proto.render = state.original;
		state.patched = state.original = undefined;
	}
}

function installUserChevron(theme: Theme) {
	const proto = UserMessageComponent?.prototype as any;
	if (typeof proto?.render !== "function") return;
	state.theme = theme;
	state.active = true;
	if (state.patched) return;
	const original = proto.render as Function;
	const patched = function (this: any, width: number): string[] {
		const t = state.theme;
		if (!state.active || !t || width < 12) return original.call(this, width);
		try {
			const inner = original.call(this, width - 3) as string[];
			if (!Array.isArray(inner) || inner.some((l) => typeof l !== "string")) return original.call(this, width);
			// drop the padding rows Markdown adds (paddingY=1)
			const body = inner.filter((l, i) => !(i === 0 || i === inner.length - 1) || l.replace(STRIP, "").trim() !== "");
			return body.map((l, i) => {
				const osc = l.match(OSC)?.[1] ?? "";
				const rest = l.slice(osc.length).replace(/^((?:\x1b\[[0-9;]*m)*) /, "$1");
				return osc + (i === 0 ? t.fg("accent", " ❯ ") : "   ") + rest;
			});
		} catch {
			return original.call(this, width);
		}
	};
	state.original = original;
	state.patched = patched;
	proto.render = patched;
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_e, ctx) => {
		installUserChevron(ctx.ui.theme);

		// ---- header (public API)
		if (ctx.mode !== "tui") return;
		ctx.ui.setHeader((_tui, theme) => {
			let expanded = false;
			const skills = () => pi.getCommands().filter((c) => c.source === "skill").map((c) => c.name.replace(/^skill:/, "")).sort();
			const exts = extensionNames();
			return {
				setExpanded(v: boolean) {
					expanded = v;
				},
				render(width: number): string[] {
					const sk = skills();
					const sep = theme.fg("borderMuted", "  ·  ");
					const count = (n: number, w: string) => theme.fg("text", String(n)) + " " + theme.fg("dim", w);
					const hint = keyHint("app.tools.expand", expanded ? "to collapse" : "to list");
					if (!expanded) {
						// Pi's own 4x2 half-block logo (pi-logo.js is not exported), fixed brand colors.
						const fg = (r: number, g: number, b: number) => `\x1b[38;2;${r};${g};${b}m`;
						const CORAL = fg(228, 138, 122), BLUE = fg(79, 142, 179), YELLOW = fg(234, 182, 93), R = "\x1b[0m";
						const top = `${CORAL}\x1b[48;2;79;142;179m▀${R}${CORAL}▀█${R} `;
						const bottom = `${BLUE}█▀${R} ${YELLOW}█${R}`;
						const l1 = ` ${top}  ${theme.fg("text", "pi")} ${theme.fg("dim", `v${VERSION}`)}`;
						const l2 = ` ${bottom}  ${[count(sk.length, "skills"), count(exts.length, "extensions")].join(sep)}`;
						const gap = width - visibleWidth(l2) - visibleWidth(hint) - 1;
						return ["", truncateToWidth(l1, width), gap > 1 ? l2 + " ".repeat(gap) + hint : truncateToWidth(l2, width), ""];
					}
					const row = (label: string, items: string[]) => {
						const head = " " + theme.fg("dim", label.padEnd(11));
						const sep = theme.fg("borderMuted", " · ");
						const max = Math.max(10, width - 13);
						const lines: string[] = [];
						let cur = "";
						for (const it of items) {
							if (cur && visibleWidth(cur) + 3 + visibleWidth(it) > max) {
								lines.push(cur);
								cur = "";
							}
							cur += (cur ? sep : "") + theme.fg("muted", it);
						}
						if (cur) lines.push(cur);
						return lines.map((l, i) => (i ? " ".repeat(12) : head) + l);
					};
					const title = ` ${theme.fg("text", "pi")} ${theme.fg("dim", `v${VERSION}`)}`;
					const gap = width - visibleWidth(title) - visibleWidth(hint) - 1;
					return ["", gap > 1 ? title + " ".repeat(gap) + hint : truncateToWidth(title, width), ...row("skills", sk), ...row("extensions", exts), ""];
				},
				invalidate() {},
			};
		});
	});

	pi.on("session_shutdown", uninstall);
}
