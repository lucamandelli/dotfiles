// Session chrome: Pi logo header (replaces the [Skills]/[Extensions] listing; needs quietStartup: true)
// and your own messages marked by a cyan bar on every line (no background).
// Header: public API (setHeader). User bar: wraps private UserMessageComponent.prototype.render,
// installed on session_start, restored on session_shutdown, native render if anything looks different.
// Fallback by design: the theme gives userMessageBg a light tint. The bar render strips that tint; if the
// patch is off (Pi changed the component), Pi paints the tint and your messages still stand out.
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
// Background SGR sequences (set and reset): the tinted fallback is removed so the bar is the only marker.
const BG = /\x1b\[(?:48;[0-9;]+|49)m/g;
const BAR = "\x1b[38;2;125;207;255m▌\x1b[39m"; // #7dcfff, same cyan as the cwd in the footer

// Patch state lives on globalThis so /reload (new module instance) and other packages wrapping the same
// prototype method cannot stack a second copy. The wrapper installed once only delegates to `state.render`,
// which every session_start replaces with the current code, so a /reload picks up edits (a wrapper that kept
// its own closure would keep running the code of the first load). OLD_KEY is the first version of this patch
// (a chevron, closure-bound): switch it off so a still-installed old wrapper passes through.
const KEY = Symbol.for("dotfiles.pi.session-chrome.bar");
const OLD_KEY = Symbol.for("dotfiles.pi.session-chrome");
type Render = (self: any, width: number, original: Function) => string[];
type State = { active: boolean; theme?: Theme; original?: Function; patched?: Function; render?: Render };
const state = ((globalThis as any)[KEY] ??= { active: false }) as State;

function uninstall() {
	state.active = false;
	const proto = UserMessageComponent?.prototype as any;
	if (proto && state.patched && proto.render === state.patched && state.original) {
		proto.render = state.original;
		state.patched = state.original = undefined;
	}
}

const barRender: Render = (self, width, original) => {
	const inner = original.call(self, width - 3) as string[];
	if (!Array.isArray(inner) || inner.some((l) => typeof l !== "string")) return original.call(self, width);
	// drop the padding rows Markdown adds (paddingY=1), keeping the OSC 133 prompt-zone marks they carry
	const blank = (l: string) => l.replace(STRIP, "").trim() === "";
	const zone = (l: string) => l.match(OSC)?.[1] ?? "";
	const dropFirst = blank(inner[0]!) && inner.length > 2;
	const dropLast = blank(inner[inner.length - 1]!) && inner.length > 2;
	const body = inner.slice(dropFirst ? 1 : 0, dropLast ? -1 : undefined);
	const head = dropFirst ? zone(inner[0]!) : "";
	const tail = dropLast ? zone(inner[inner.length - 1]!) : "";
	return body.map((l, i) => {
		const osc = zone(l);
		const rest = l.slice(osc.length).replace(BG, "").replace(/^((?:\x1b\[[0-9;]*m)*) /, "$1");
		return `${i === 0 ? head : ""}${osc} ${BAR} ${rest}${i === body.length - 1 ? tail : ""}`;
	});
};

function installUserBar(theme: Theme) {
	const proto = UserMessageComponent?.prototype as any;
	if (typeof proto?.render !== "function") return;
	const old = (globalThis as any)[OLD_KEY];
	if (old) old.active = false;
	state.theme = theme;
	state.render = barRender;
	state.active = true;
	if (state.patched) return;
	const original = proto.render as Function;
	const patched = function (this: any, width: number): string[] {
		if (!state.active || !state.theme || !state.render || width < 12) return original.call(this, width);
		try {
			return state.render(this, width, original);
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
		installUserBar(ctx.ui.theme);

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
