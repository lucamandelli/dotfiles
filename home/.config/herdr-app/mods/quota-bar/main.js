// Bottom bar for layouts/pi.json: how much of each logged-in subscription is left to spend.
// One chip per provider (quota-axi): 5h and weekly usage % with the local reset time. The chip of the
// focused session's provider is highlighted. Replaces workspace-status and keeps its right-hand items.
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { agents, exec, home, keys, run, theme, window } from "herdr";
import { KEY_COLOR, focusedTerminal, providerKeyOf } from "./pi-session.js";

// The app's exec PATH does not include mise, so try mise's shims dir (same path on Linux and macOS; the shim
// needs no PATH of its own) and ~/.local/bin before the bare name. The first one that runs is remembered.
const quotaAxi = () => [`${home()}/.local/share/mise/shims/quota-axi`, `${home()}/.local/bin/quota-axi`, "quota-axi"];
const REFRESH_MS = 60_000;
const MAX_AGE = "45s";
const STALE_MS = 3 * 60_000;
const SESSION_MS = 5 * 3_600_000;
const ORDER = ["claude", "codex", "grok"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n) => String(n).padStart(2, "0");
const clock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// "15:10" when the reset is today, "Wed 19:59" otherwise (local time).
export function resetTime(at, now) {
  const d = new Date(at);
  const n = new Date(now);
  const today = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  return today ? clock(d) : `${DAYS[d.getDay()]} ${clock(d)}`;
}

// quota-axi --json -> { claude: {status, windows, refreshedAt, stale}, ... } (same reading rules as the Pi footer).
export function parseQuota(json, fetchedAt) {
  const out = {};
  for (const p of json?.providers ?? []) {
    if (!ORDER.includes(p?.provider)) continue;
    const auth = p.state?.authStatus;
    if (p.error || p.state?.status === "error" || (auth && auth !== "usable")) {
      out[p.provider] = { status: "error", message: !auth || /expir/i.test(auth) ? "auth expired" : "auth error" };
      continue;
    }
    const windows = [];
    for (const kind of ["session", "weekly"]) {
      const w = (p.windows ?? []).find((x) => x.kind === kind && !/^(model|product):/.test(x.id) && typeof x.percentRemaining === "number");
      if (w) windows.push({ kind, used: Math.round(100 - w.percentRemaining), resetsAt: w.resetsAt ? Date.parse(w.resetsAt) : undefined });
    }
    if (windows.length === 0) continue;
    const refreshed = p.state?.refreshedAt ? Date.parse(p.state.refreshedAt) : fetchedAt;
    out[p.provider] = { status: "ok", windows, refreshedAt: Math.min(refreshed, fetchedAt), stale: !!p.state?.stale };
  }
  return out;
}

export default class QuotaBar extends View {
  init(_props, cx) {
    this.quota = null;
    this.fetchedAt = 0;
    this.failed = false;
    cx.timer.every(REFRESH_MS, (cx) => this.refresh(cx));
    this.refresh(cx);
  }

  refresh(cx) {
    cx.spawn(async (cx) => {
      try {
        const args = ["--json", "--max-age", MAX_AGE, "--provider", "claude,codex,grok"];
        let r;
        for (const bin of this.bin ? [this.bin] : quotaAxi()) {
          try {
            r = await exec(bin, args);
            this.bin = bin;
            break;
          } catch {} // not found there: next candidate
        }
        if (!r) throw new Error("quota-axi not found");
        const now = Date.now();
        this.quota = parseQuota(JSON.parse(r.stdout), now);
        this.fetchedAt = now;
        this.failed = false;
      } catch {
        this.failed = true; // keep the last reading; it ages into "stale"
      }
      cx.notify();
    });
  }

  hint(t) {
    const mac = window()?.platform === "macos";
    const mod = { cmd: mac ? "⌘" : "Ctrl+", ctrl: mac ? "⌃" : "Ctrl+", shift: mac ? "⇧" : "Shift+", alt: mac ? "⌥" : "Alt+", option: mac ? "⌥" : "Alt+" };
    const b = keys().find((k) => k.section === "global" && k.action === "app.palette");
    const parts = b && b.keys.endsWith("--") ? [...b.keys.slice(0, -2).split("-"), "-"] : b?.keys.split("-");
    const key = parts && parts.map((p) => mod[p.toLowerCase()] ?? p.toUpperCase()).join("");
    return key ? `${key}  commands` : "commands";
  }

  windowPart(t, w, q, stale, now) {
    const tag = w.kind === "session" ? "5h" : "wk";
    const rolled = w.resetsAt !== undefined && w.resetsAt <= now; // already reset; the percent we hold is from before
    const idle = w.kind === "session" && w.used <= 0 && w.resetsAt !== undefined && w.resetsAt - q.refreshedAt >= SESSION_MS - 3 * 60_000;
    const color = w.used >= 80 ? t.ansi1 : w.used >= 50 ? t.ansi3 : t.ansi2;
    const el = h_flex().gap(4).items_center().flex_none().child(div().text_color(stale || rolled ? t.dim : t.muted).child(tag));
    el.child(rolled ? div().text_color(t.dim).child("reset")
      : div().font_semibold().text_color(stale ? t.dim : color).child(`${stale ? "~" : ""}${w.used}%`));
    if (!rolled && idle) el.child(div().text_color(t.dim).child("↻ not started"));
    else if (!rolled && w.resetsAt !== undefined) el.child(div().text_color(t.dim).child(`↻ ${resetTime(w.resetsAt, now)}`));
    return el;
  }

  chip(t, key, q, active, now) {
    const color = KEY_COLOR[key];
    const el = h_flex().id(`quota-${key}`).flex_none().h(20).px(9).gap(7).items_center().rounded(6).border(1)
      .border_color(active ? color + "aa" : "#00000000")
      .when(active, (e) => e.bg(color + "22"))
      .child(div().size(6).rounded(3).flex_none().bg(color))
      .child(div().font_semibold().text_color(active ? color : t.foreground).child(key));
    if (q.status === "error") return el.child(div().text_color(t.blocked).child(`! ${q.message}`));
    const stale = q.stale || now - q.refreshedAt > STALE_MS;
    q.windows.forEach((w, i) => {
      if (i > 0) el.child(div().text_color(t.dim).child("·"));
      el.child(this.windowPart(t, w, q, stale, now));
    });
    if (stale) el.child(div().text_color(t.working).child(`updated ${clock(new Date(q.refreshedAt))}`));
    return el;
  }

  render() {
    const t = theme();
    const now = Date.now();
    const list = agents();
    const needs = list.filter((a) => a.status === "blocked").length;
    const activeKey = providerKeyOf(focusedTerminal());
    const bar = h_flex().size_full().px(10).gap(8).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted);
    if (!this.quota) bar.child(div().text_color(t.dim).child(this.failed ? "quota unavailable" : "quota loading…"));
    else {
      for (const key of ORDER) {
        const q = this.quota[key];
        if (q) bar.child(this.chip(t, key, q, key === activeKey, now));
      }
      if (this.failed) bar.child(div().text_color(t.working).child("quota unavailable"));
    }
    return bar
      .child(div().flex_1())
      .when(this.fetchedAt > 0, (e) => e.child(div().text_color(t.dim).child(`updated ${clock(new Date(this.fetchedAt))}`)))
      .child(h_flex().gap(6).items_center().flex_none().child(div().size(6).rounded(3).bg(t.dim)).child(`${list.length} agents`)
        .when(needs > 0, (e) => e.child(div().text_color(t.blocked).child(`· ${needs} needs you`))))
      .child(div().id("palette").flex_none().text_color(t.dim).on_click(() => run("app.palette")).child(this.hint(t)));
  }
}
