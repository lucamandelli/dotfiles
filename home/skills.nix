# Global agent skills, linked per skill into ~/.agents/skills (Pi, Codex, Grok)
# and ~/.claude/skills (Claude Code, Grok). Sources are pinned in flake.lock.
# Each skill is a self-contained dir (no ../ references), so linking the dir is enough.
{ lib, inputs, ... }:

let
  mp = "${inputs.mattpocock-skills}/skills";
  addy = "${inputs.addy-skills}/skills";
  pstack = "${inputs.cursor-plugins}/pstack/skills";

  # name = source dir. The name must match the dir's SKILL.md `name:`.
  skills = {
    # mattpocock/skills (grill-me needs grilling; to-spec and to-tickets need setup-matt-pocock-skills)
    grill-me = "${mp}/productivity/grill-me";
    grilling = "${mp}/productivity/grilling";
    wait-what = "${mp}/productivity/wait-what";
    writing-for-agents = "${mp}/productivity/writing-for-agents";  # retro needs it
    diagnosing-bugs = "${mp}/engineering/diagnosing-bugs";
    retro = "${mp}/engineering/retro";
    setup-matt-pocock-skills = "${mp}/engineering/setup-matt-pocock-skills";
    to-spec = "${mp}/engineering/to-spec";
    to-tickets = "${mp}/engineering/to-tickets";
    # addyosmani/agent-skills
    source-driven-development = "${addy}/source-driven-development";
    # cursor/plugins pstack
    create-verification-skill = "${pstack}/create-verification-skill";
    maintain-verification-skill = "${pstack}/maintain-verification-skill";
  };
in

{
  home.file = lib.concatMapAttrs (name: src: {
    ".agents/skills/${name}".source = src;
    ".claude/skills/${name}".source = src;
  }) skills;
}
