// What is running in the focused terminal: context gauge, model, effort. Follows focus.
// Data: the Pi `pi.session` label (herdr-session.ts); other agents show their name only.
// Lives above the Spaces list in layouts/pi.json.
import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { PathBuilder } from "gpui-kit";
import { panes, theme } from "herdr";
import { EFFORT_COLOR, KEY_COLOR, PROVIDERS, focusedTerminal, formatTokens, providerKeyOf, sessionOf, shortModel } from "./pi-session.js";

const SIZE = 112;
const STROKE = 9;
const START = 135; // degrees, clockwise from 3 o'clock: the gauge opens at the bottom
const SWEEP = 270;

// `window` here is the gpui global, not herdr's window(); paint_path takes coordinates relative to the element.
function arc(color, from, to) {
  const r = SIZE / 2 - STROKE / 2 - 1;
  const c = SIZE / 2;
  const pt = (deg) => [c + r * Math.cos((deg * Math.PI) / 180), c + r * Math.sin((deg * Math.PI) / 180)];
  const [x1, y1] = pt(from);
  const [x2, y2] = pt(to);
  const path = PathBuilder.stroke(STROKE).move_to(x1, y1).arc_to(r, r, 0, to - from > 180, true, x2, y2).build();
  return globalThis.window.paint_path(path, color).absolute().size_full();
}

function gauge(t, pct, tokens, window) {
  const used = pct == null ? 0 : Math.min(100, Math.max(0, pct));
  const color = used >= 90 ? t.ansi1 : used >= 70 ? t.ansi3 : t.ansi4;
  const el = div().relative().flex_none().w(SIZE).h(SIZE).child(arc(t.border, START, START + SWEEP));
  if (used > 0) el.child(arc(color, START, START + Math.max(2, (SWEEP * used) / 100)));
  return el.child(
    v_flex().absolute().size_full().items_center().justify_center()
      .child(div().text_size(22).font_bold().text_color(t.foreground).child(pct == null ? "?" : `${Math.round(pct)}%`))
      .child(div().text_size(11).text_color(t.muted).child(`${formatTokens(tokens)}/${formatTokens(window)}`))
      .child(div().text_size(10).text_color(t.dim).child("tokens")),
  );
}

export default class SessionCard extends View {
  init() {
    this.last = null;
  }

  render() {
    const t = theme();
    const term = focusedTerminal() ?? this.last;
    this.last = term;
    const pane = panes().find((p) => p.terminal === term);
    const s = sessionOf(term);
    const key = providerKeyOf(term);
    const color = (s?.provider && PROVIDERS[s.provider]?.color) || KEY_COLOR[key] || t.foreground;
    const agent = pane?.program?.name ?? "Terminal";

    const body = s
      ? v_flex().flex_1().min_w(0).gap(3)
          .child(div().truncate().text_size(11).text_color(t.dim).child(key ? `${agent} · ${key}` : agent))
          .child(div().truncate().text_size(19).font_bold().text_color(color).child(shortModel(s.model)))
          .child(h_flex().child(div().px(7).h(20).flex().items_center().rounded(5).text_size(11.5).font_semibold()
            .bg((EFFORT_COLOR[s.effort] ?? t.muted) + "30").text_color(EFFORT_COLOR[s.effort] ?? t.muted).child(`effort ${s.effort}`)))
      : v_flex().flex_1().min_w(0).gap(3)
          .child(div().truncate().text_size(19).font_bold().text_color(color).child(agent))
          .child(div().text_size(11).text_color(t.dim).child(key ? `${key} · no model data` : "no model data"));

    return div().size_full().p(8).child(
      h_flex().size_full().items_center().gap(10).px(10).rounded(9).bg(t.surface).border(1).border_color(t.border)
        .when(Boolean(s), (el) => el.child(gauge(t, s.pct, s.tokens, s.window)))
        .child(body),
    );
  }
}
