// Code blocks as a panel (language in the corner, no visible fences).
// NOT public API: wraps pi-tui Markdown.prototype.renderToken for "code" tokens.
// Installed on session_start, restored on session_shutdown; falls back to Pi's native render on any shape mismatch.
import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { Markdown, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

const pad = (s: string, w: number) => s + " ".repeat(Math.max(0, w - visibleWidth(s)));

function panel(theme: Theme, self: any, token: any, width: number, nextTokenType?: string): string[] | undefined {
	if (typeof token.text !== "string" || typeof self?.theme?.highlightCode !== "function") return undefined;
	const lang = String(token.lang ?? "").trim();
	const code: unknown = self.theme.highlightCode(token.text, lang);
	if (!Array.isArray(code)) return undefined;
	const inner = Math.max(10, width - 4);
	const bg = (s: string) => theme.bg("toolPendingBg", s);
	const label = lang ? theme.fg("dim", lang) : "";
	const out = [bg(pad(" ".repeat(Math.max(1, width - 1 - visibleWidth(label))) + label, width - 1) + " ")];
	for (const l of code as string[])
		for (const w of wrapTextWithAnsi(l, inner)) out.push(bg("  " + pad(truncateToWidth(w, inner), inner) + "  "));
	out.push(bg(" ".repeat(width)));
	if (nextTokenType && nextTokenType !== "space") out.push("");
	return out;
}

// Patch state lives on globalThis so /reload (new module instance) and other packages wrapping the same
// prototype method cannot stack a second copy: the wrapper stays installed and is only switched on/off.
const KEY = Symbol.for("dotfiles.pi.code-box");
type State = { active: boolean; theme?: Theme; original?: Function; patched?: Function };
const state = ((globalThis as any)[KEY] ??= { active: false }) as State;

function uninstall() {
	state.active = false;
	const proto = Markdown?.prototype as any;
	if (proto && state.patched && proto.renderToken === state.patched && state.original) {
		proto.renderToken = state.original;
		state.patched = state.original = undefined;
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_e, ctx) => {
		const proto = Markdown?.prototype as any;
		if (typeof proto?.renderToken !== "function") return;
		state.theme = ctx.ui.theme;
		state.active = true;
		if (state.patched) return;
		const original = proto.renderToken as Function;
		const patched = function (this: any, token: any, width: number, nextTokenType?: string, styleContext?: any) {
			if (state.active && state.theme && token?.type === "code") {
				try {
					const out = panel(state.theme, this, token, width, nextTokenType);
					if (out) return out;
				} catch {}
			}
			return original.call(this, token, width, nextTokenType, styleContext);
		};
		state.original = original;
		state.patched = patched;
		proto.renderToken = patched;
	});

	pi.on("session_shutdown", uninstall);
}
