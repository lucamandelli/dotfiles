// Footer (Starship-prose statusline with subscription quota used %) + C3 "Rail" prompt box.
// Pairs with themes/tokyo-quota.json. Quota comes from `quota-axi --json`, refreshed off the render path.
import { execFile } from "node:child_process";
import { basename } from "node:path";
import { CustomEditor, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

// ---------------------------------------------------------------- palette
const HEX = {
	model: "#7aa2f7",
	cwd: "#7dcfff",
	git: "#bb9af7",
	ctx: "#7aa2f7",
	claude: "#ff9e64",
	codex: "#2ac3de",
	grok: "#c0caf5",
} as const;

const REFRESH_MS = 60_000;
const TICK_MS = 30_000;
const STALE_MS = 5 * 60_000;
const EXEC_TIMEOUT_MS = 10_000;

const ICON = { branch: "\uf418", brain: "\u{f09d1}", gauge: "\u{f0f86}", reset: "\u{f06b0}" };

// ---------------------------------------------------------------- types
export type ProviderId = "claude" | "codex" | "grok";
const PROVIDERS: ProviderId[] = ["claude", "codex", "grok"];
const PI_PROVIDER: Record<string, ProviderId> = { anthropic: "claude", "openai-codex": "codex", xai: "grok" };
const SHORT: Record<ProviderId, string> = { claude: "cl", codex: "cx", grok: "gk" };
const INITIAL: Record<ProviderId, string> = { claude: "C", codex: "X", grok: "G" };

export interface QuotaWindow {
	id: string;
	kind: "session" | "weekly";
	pct: number;
	resetsAt?: number; // epoch ms
}
export type ProviderQuota =
	| { status: "absent" }
	| { status: "error"; message: string }
	| { status: "ok"; windows: QuotaWindow[]; limiting: string; effective: number; refreshedAt: number; stale: boolean };
export interface QuotaSnapshot {
	fetchedAt: number;
	providers: Record<ProviderId, ProviderQuota>;
}

export interface Theme {
	fg(role: string, text: string): string;
}
export interface FooterInput {
	cwd: string;
	branch: string | null;
	model: { id: string; provider: string; reasoning?: boolean } | undefined;
	effort: string;
	ctxPercent: number | null;
	ctxWindow: number | undefined;
	quota: QuotaSnapshot | undefined;
	quotaFailed: boolean;
	now: number;
}

// ---------------------------------------------------------------- parsing quota-axi output
export function parseQuota(json: any, fetchedAt: number): QuotaSnapshot {
	const providers = { claude: { status: "absent" }, codex: { status: "absent" }, grok: { status: "absent" } } as Record<
		ProviderId,
		ProviderQuota
	>;
	for (const p of json?.providers ?? []) {
		const id = p?.provider as ProviderId;
		if (!PROVIDERS.includes(id)) continue;
		const auth: string | undefined = p.state?.authStatus;
		if (p.error || p.state?.status === "error" || (auth && auth !== "usable")) {
			providers[id] = { status: "error", message: !auth || /expir/i.test(auth) ? "auth expired" : "auth error" };
			continue;
		}
		const windows: QuotaWindow[] = [];
		for (const kind of ["session", "weekly"] as const) {
			const w = (p.windows ?? []).find(
				(x: any) => x.kind === kind && !/^(model|product):/.test(x.id) && typeof x.percentRemaining === "number",
			);
			if (w) windows.push({ id: w.id, kind, pct: w.percentRemaining, resetsAt: w.resetsAt ? Date.parse(w.resetsAt) : undefined });
		}
		if (windows.length === 0) {
			providers[id] = { status: "absent" };
			continue;
		}
		const eff = (p.quotaSemantics?.effectiveAvailability ?? []).find(
			(e: any) => e.scope === "all_models" || e.scope === "all_products",
		);
		let limiting: string | undefined = eff?.limitingWindowIds?.[0];
		if (!windows.some((w) => w.id === limiting)) limiting = windows.reduce((a, b) => (b.pct < a.pct ? b : a)).id;
		const effective =
			typeof eff?.effectivePercentRemaining === "number" ? eff.effectivePercentRemaining : windows.find((w) => w.id === limiting)!.pct;
		const refreshed = p.state?.refreshedAt ? Date.parse(p.state.refreshedAt) : fetchedAt;
		providers[id] = { status: "ok", windows, limiting: limiting!, effective, refreshedAt: Math.min(refreshed, fetchedAt), stale: !!p.state?.stale };
	}
	return { fetchedAt, providers };
}

// ---------------------------------------------------------------- formatting helpers
const rgb = (hex: string, text: string) => {
	const n = Number.parseInt(hex.slice(1), 16);
	return `\x1b[38;2;${n >> 16};${(n >> 8) & 255};${n & 255}m${text}\x1b[39m`;
};
const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;

export function shortModel(id: string): string {
	if (!id.startsWith("claude-")) return id;
	return id
		.slice("claude-".length)
		.replace(/-\d{8}$/, "")
		.replace(/-(\d)-(\d)(?=-|$)/, "-$1.$2");
}
const EFFORT_SHORT: Record<string, string> = { off: "off", minimal: "min", low: "low", medium: "med", high: "high", xhigh: "xhi", max: "max" };
const EFFORT_ROLE: Record<string, string> = {
	off: "thinkingOff",
	minimal: "thinkingMinimal",
	low: "thinkingLow",
	medium: "thinkingMedium",
	high: "thinkingHigh",
	xhigh: "thinkingXhigh",
	max: "thinkingMax",
};
export function formatWindow(n: number): string {
	if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(1))}M`;
	return `${Math.round(n / 1000)}k`;
}
export function formatCountdown(ms: number): string {
	const mins = Math.max(0, Math.floor(ms / 60_000));
	if (mins < 60) return `${mins}m`;
	const h = Math.floor(mins / 60);
	if (h < 24) return `${h}h${String(mins % 60).padStart(2, "0")}m`;
	return `${Math.floor(h / 24)}d${h % 24}h`;
}
const formatAge = (ms: number) => {
	const m = Math.floor(ms / 60_000);
	return m >= 60 ? `${Math.floor(m / 60)}h` : `${m}m`;
};
// pct here is quota USED (100 - remaining)
const usedPct = (remaining: number) => Math.round(100 - remaining);
const pctRole = (used: number) => (used >= 80 ? "error" : used >= 50 ? "warning" : "success");

// ---------------------------------------------------------------- footer rendering (pure)
interface Level {
	n: number;
	repo: boolean; // repo + branch on line 1
	words: boolean; // "on" / "with"
	bar: number; // 0 = no bar
	shortEffort: boolean;
	bothWindows: boolean;
	names: "full" | "short" | "initial";
	resetOnlyLow: boolean;
}
const LEVELS: Level[] = [
	{ n: 1, repo: true, words: true, bar: 10, shortEffort: false, bothWindows: true, names: "full", resetOnlyLow: false },
	{ n: 2, repo: true, words: true, bar: 10, shortEffort: false, bothWindows: false, names: "full", resetOnlyLow: false },
	{ n: 3, repo: true, words: false, bar: 6, shortEffort: false, bothWindows: false, names: "full", resetOnlyLow: false },
	{ n: 4, repo: false, words: false, bar: 6, shortEffort: false, bothWindows: false, names: "full", resetOnlyLow: false },
	{ n: 5, repo: false, words: false, bar: 0, shortEffort: true, bothWindows: false, names: "short", resetOnlyLow: true },
	{ n: 6, repo: false, words: false, bar: 0, shortEffort: true, bothWindows: false, names: "initial", resetOnlyLow: true },
];

function line1(t: Theme, i: FooterInput, lv: Level, width: number): string {
	const muted = (s: string) => t.fg("muted", s);
	const left = lv.repo
		? bold(rgb(HEX.cwd, basename(i.cwd) || i.cwd)) +
			(lv.words ? muted(" on ") : " ") +
			(i.branch ? `${rgb(HEX.git, `${ICON.branch} `)}${bold(rgb(HEX.git, i.branch))}` : t.fg("dim", "no branch"))
		: "";

	let model = "";
	if (i.model) {
		model = `${rgb(HEX.model, `${ICON.brain} `)}${bold(rgb(HEX.model, shortModel(i.model.id)))}`;
		if (i.model.reasoning !== false) {
			const effort = i.effort === "off" && !lv.shortEffort ? "no think" : lv.shortEffort ? (EFFORT_SHORT[i.effort] ?? i.effort) : i.effort;
			model += (lv.words ? muted(" with ") : " ") + bold(t.fg(EFFORT_ROLE[i.effort] ?? "thinkingOff", effort));
		}
	} else model = t.fg("dim", "no model");

	// context
	const pct = i.ctxPercent;
	const color = (s: string) => (pct === null ? t.fg("muted", s) : pct >= 90 ? t.fg("error", s) : pct >= 70 ? t.fg("warning", s) : rgb(HEX.ctx, s));
	let ctx = `${color(`${ICON.gauge} `)}${bold(color(pct === null ? "?" : `${Math.round(pct)}%`))}`;
	if (i.ctxWindow) ctx += muted(` of ${formatWindow(i.ctxWindow)}`);
	if (lv.bar > 0) {
		const filled = pct === null ? 0 : Math.min(lv.bar, Math.max(pct > 0 ? 1 : 0, Math.round((pct / 100) * lv.bar)));
		ctx += ` ${color("━".repeat(filled))}${t.fg("borderMuted", "─".repeat(lv.bar - filled))}`;
	}
	const right = `${model}   ${ctx}`;
	if (!left) return right;
	const gap = width - visibleWidth(left) - visibleWidth(right);
	return gap >= 2 ? left + " ".repeat(gap) + right : `${left}  ${right}`; // overflow is caught by the fit check
}

function line2(t: Theme, i: FooterInput, lv: Level): string {
	const sep = t.fg("borderMuted", lv.n >= 6 ? " " : "  ·  ");
	if (!i.quota) return t.fg("dim", i.quotaFailed ? "quota unavailable" : "quota loading…");
	const active = i.model ? PI_PROVIDER[i.model.provider] : undefined;
	const cells = PROVIDERS.map((id) => {
		const q = i.quota!.providers[id];
		const isActive = id === active;
		const label = lv.names === "full" ? id : lv.names === "short" ? SHORT[id] : INITIAL[id];
		const name = (isActive ? bold : (s: string) => s)(rgb(HEX[id], label));
		const marker = isActive ? bold(t.fg("accent", "▸")) : "";
		if (q.status === "absent") return lv.names === "initial" ? t.fg("borderMuted", `${label} --`) : t.fg("borderMuted", `${label} not set up`);
		if (q.status === "error")
			return marker + (lv.names === "initial" ? bold(t.fg("error", `${label} !`)) : bold(t.fg("error", `${label} ! ${q.message}`)));
		const age = i.now - q.refreshedAt;
		const stale = q.stale || age > STALE_MS;
		const lim = q.windows.find((w) => w.id === q.limiting)!;
		const shown = lv.bothWindows ? q.windows : [lim];
		const parts = shown.map((w, idx) => {
			const pct = usedPct(w.id === lim.id ? q.effective : w.pct);
			const tag = w.kind === "session" ? "5h" : "wk";
			const val = stale ? t.fg("dim", `~${pct}%`) : bold(t.fg(pctRole(pct), `${pct}%`));
			if (lv.names === "initial") return val;
			let s = `${val} ${t.fg(stale ? "dim" : "muted", tag)}`;
			const showReset = w.id === lim.id && w.resetsAt !== undefined && (!lv.resetOnlyLow || usedPct(q.effective) >= 80);
			if (showReset) s += ` ${t.fg("dim", `${ICON.reset}${formatCountdown(w.resetsAt! - i.now)}`)}`;
			return idx === 0 ? s : `${t.fg("borderMuted", "· ")}${s}`;
		});
		let cell = `${marker}${name} ${parts.join(" ")}`;
		if (stale && lv.names !== "initial") cell += t.fg("warning", ` (${formatAge(age)} old)`);
		return cell;
	});
	return cells.join(sep);
}

export function renderFooter(t: Theme, i: FooterInput, width: number): string[] {
	if (width < 1) return [];
	let last: string[] = [];
	for (const lv of LEVELS) {
		last = [line1(t, i, lv, width), line2(t, i, lv)];
		if (last.every((l) => visibleWidth(l) <= width)) return last;
	}
	return last.map((l) => truncateToWidth(l, width));
}

// ---------------------------------------------------------------- extension
export default function (pi: ExtensionAPI) {
	let ctx: ExtensionContext | undefined;
	let requestRender: (() => void) | undefined;
	let quota: QuotaSnapshot | undefined;
	let quotaFailed = false;
	let inflight = false;
	let timers: ReturnType<typeof setInterval>[] = [];

	const refreshQuota = () => {
		if (inflight) return;
		inflight = true;
		execFile(
			"quota-axi",
			["--json", "--max-age", "90s", "--no-credential-refresh", "--provider", "claude,codex,grok"],
			{ timeout: EXEC_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
			(err, stdout) => {
				inflight = false;
				try {
					quota = parseQuota(JSON.parse(stdout), Date.now());
					quotaFailed = false;
				} catch {
					quotaFailed = true; // keep last good snapshot; it ages into "stale"
					void err;
				}
				requestRender?.();
			},
		);
	};

	const stop = () => {
		for (const t of timers) clearInterval(t);
		timers = [];
		requestRender = undefined;
	};

	for (const ev of ["model_select", "thinking_level_select", "turn_end", "message_end"] as const)
		pi.on(ev, () => requestRender?.());
	pi.on("session_shutdown", stop);

	pi.on("session_start", (_e, c) => {
		stop();
		ctx = c;
		refreshQuota();
		timers.push(setInterval(refreshQuota, REFRESH_MS), setInterval(() => requestRender?.(), TICK_MS));
		for (const t of timers) t.unref?.();

		c.ui.setFooter((tui, theme, footerData) => {
			requestRender = () => tui.requestRender();
			const offBranch = footerData.onBranchChange(() => tui.requestRender());
			return {
				render(width: number): string[] {
					const usage = c.getContextUsage();
					return renderFooter(
						theme,
						{
							cwd: c.cwd,
							branch: footerData.getGitBranch(),
							model: c.model,
							effort: pi.getThinkingLevel(),
							ctxPercent: usage?.percent ?? null,
							ctxWindow: usage?.contextWindow ?? c.model?.contextWindow,
							quota,
							quotaFailed,
							now: Date.now(),
						},
						width,
					);
				},
				invalidate() {},
				dispose() {
					offBranch();
					requestRender = undefined;
				},
			};
		});

		c.ui.setEditorComponent((tui, theme, kb) => {
			class RailEditor extends CustomEditor {
				constructor() {
					super(tui, theme, kb, { paddingX: 0 });
				}
				render(width: number): string[] {
					if (width < 10) return super.render(width);
					const ui = ctx?.ui.theme;
					if (!ui) return super.render(width);
					// rail(1) + pad(1) + prompt prefix(2)
					const inner = super.render(width - 4);
					const visible: number = (this as any).renderedVisibleLineCount ?? Math.max(1, inner.length - 2);
					const body = inner.slice(1, 1 + visible);
					const extras = inner.slice(2 + visible);
					const rule = ui.fg("borderMuted", "─".repeat(width));
					const rail = (this as any).borderColor ? (this as any).borderColor("▎") : ui.fg("borderMuted", "▎");
					const out = [rule, rail];
					body.forEach((l, idx) => out.push(`${rail} ${idx === 0 ? ui.fg("borderMuted", "❯ ") : "  "}${l}`));
					out.push(rail, rule);
					for (const l of extras) out.push(`    ${l}`);
					return out;
				}
			}
			return new RailEditor();
		});
	});
}
