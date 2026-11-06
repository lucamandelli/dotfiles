// Shared by session-card, session-header and quota-bar (Pi session facts published by
// home/.pi/agent/extensions/herdr-session.ts as the `pi.session` terminal label).
import { terminals, panes, focused, spaces } from "herdr";

// Pi provider id -> quota-axi provider key and its color (same palette as the Pi footer).
export const PROVIDERS = {
  anthropic: { key: "claude", color: "#ff9e64" },
  openai: { key: "codex", color: "#2ac3de" },
  "openai-codex": { key: "codex", color: "#2ac3de" },
  xai: { key: "grok", color: "#c0caf5" },
};
export const KEY_COLOR = { claude: "#ff9e64", codex: "#2ac3de", grok: "#c0caf5" };
// Agent `app` as reported over OSC 7501 -> provider key, for agents that publish no pi.session.
const APP_KEY = { "claude-code": "claude", claude: "claude", codex: "codex", grok: "grok" };

export const EFFORT_COLOR = { off: "#545c7e", minimal: "#737aa2", low: "#7aa2f7", medium: "#7dcfff", high: "#bb9af7", xhigh: "#ff007c", max: "#ff9e64" };

export function shortModel(id) {
  if (!id.startsWith("claude-")) return id;
  return id.slice("claude-".length).replace(/-\d{8}$/, "").replace(/-(\d)-(\d)(?=-|$)/, "-$1.$2");
}

export function formatTokens(n) {
  if (n == null) return "?";
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(1))}M`;
  return `${Math.round(n / 1000)}k`;
}

/** The pi.session label of a terminal, parsed, or null. */
export function sessionOf(address) {
  if (!address) return null;
  const raw = terminals().find((t) => t.address === address)?.labels?.["pi.session"];
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    return { provider: j.p, model: j.m, effort: j.e, pct: j.c, tokens: j.t, window: j.w };
  } catch {
    return null;
  }
}

/** The terminal the person is working in: the focused one, else the first terminal pane of the shown tab. */
export function focusedTerminal() {
  const f = focused();
  if (f?.terminal) return f.terminal;
  return null;
}

/** Quota provider key ("claude" | "codex" | "grok") of a terminal's agent, or null. */
export function providerKeyOf(address) {
  const s = sessionOf(address);
  if (s?.provider && PROVIDERS[s.provider]) return PROVIDERS[s.provider].key;
  const pane = panes().find((p) => p.terminal === address);
  const app = pane?.app ?? terminals().find((t) => t.address === address)?.report?.app;
  return APP_KEY[app] ?? null;
}

/** Space and tab names for a pane's tab id. */
export function placeOf(tabId) {
  for (const s of spaces()) {
    const t = s.tabs.find((t) => t.id === tabId);
    if (t) return { space: s.name, tab: t.name };
  }
  return null;
}
