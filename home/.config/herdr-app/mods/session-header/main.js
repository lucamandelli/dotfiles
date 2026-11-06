// Pane header for layouts/pi.json: WHERE this terminal is. Agent, folder, branch, space and tab, status,
// and split/zoom/close on hover. What it runs (model, effort, context) is in the session-card mod.
// Derived from Herdr's shipped `pane` header. Props from the app: { pane, terminal }. Click: focus the pane.
import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, theme, home } from "herdr";
import { placeOf } from "./pi-session.js";

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

// "~/github/firstmate" -> ["~/github/", "firstmate"]: the folder name stands out, the path before it is dim.
function folder(cwd) {
  if (!cwd) return ["", ""];
  const h = home();
  const full = cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
  const i = full.lastIndexOf("/");
  return i <= 0 || full === "/" ? ["", full] : [full.slice(0, i + 1), full.slice(i + 1)];
}

export default class SessionHeader extends View {
  init() { this.hovered = false; }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  button(t, id, file, command, args) {
    return div()
      .id(id)
      .p(3)
      .rounded(4)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`mods/session-header/${file}.svg`).size(14));
  }

  render() {
    const t = theme();
    const p = this.me();
    if (!p) return div();
    const name = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const pic = icon(p.program, 14, t.dim);
    const st = p.status;
    const pane = p.pane;
    const [dir, leaf] = folder(p.cwd);
    const place = placeOf(p.tab);
    const dot = () => div().flex_none().text_color(t.dim).child("·");
    return h_flex()
      .id(`session-head-${pane}`)
      .size_full()
      .px(10)
      .gap(8)
      .items_center()
      .bg(t.background)
      .border_b(1)
      .border_color(t.border)
      .text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_none().truncate().max_w(200).font_medium().text_color(t.foreground).child(name))
      .when(Boolean(leaf), (el) => el.child(dot()).child(h_flex().min_w(0).truncate()
        .child(div().text_color(t.dim).child(dir)).child(div().font_semibold().text_color(t.foreground).child(leaf))))
      .when(Boolean(p.branch), (el) => el.child(dot()).child(div().flex_none().truncate().max_w(220).text_color(t.ansi5).child(`⎇ ${p.branch}`)))
      .when(Boolean(place), (el) => el.child(dot()).child(div().truncate().text_color(t.muted).child(`${place.space} · ${place.tab}`)))
      .child(div().flex_1())
      .when(st === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
      .when(st === "blocked", el => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).child("Needs you")))
      .when(st === "done", el => el.child(div().size(7).flex_none().rounded(4).bg(t.done)))
      .when(this.hovered, el => el
        .child(this.button(t, `sh-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
        .child(this.button(t, `sh-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
        .child(this.button(t, `sh-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
        .child(this.button(t, `sh-x-${pane}`, "close", "pane.close", { pane })));
  }
}
