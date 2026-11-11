# Global agent skills, linked per skill into ~/.agents/skills (Pi, Codex, Grok)
# and ~/.claude/skills (Claude Code, Grok). Sources are pinned in flake.lock.
# Each skill is a self-contained dir (no ../ references), so linking the dir is enough.
{ lib, inputs, pkgs, ... }:

let
  mp = "${inputs.mattpocock-skills}/skills";
  addy = "${inputs.addy-skills}/skills";
  pstack = "${inputs.cursor-plugins}/pstack/skills";

  typescriptSkill = pkgs.runCommand "typescript-best-practices" { } ''
    cp -R ${pstack}/typescript-best-practices "$out"
    chmod -R u+w "$out"
    substituteInPlace "$out/SKILL.md" \
      --replace-fail 'paths: ["**/*.ts", "**/*.tsx"]' "" \
      --replace-fail 'disable-model-invocation: true' 'disable-model-invocation: false'
  '';

  # name = source dir. The name must match the dir's SKILL.md `name:`.
  # Personal skills live in ./skills (this repo). Upstream skills come from flake inputs.
  skills = {
    # mattpocock/skills (grill-me needs grilling; to-spec and to-tickets need setup-matt-pocock-skills;
    # implement needs tdd; its code-review step is skipped because no-mistakes reviews)
    grill-me = "${mp}/productivity/grill-me";
    grilling = "${mp}/productivity/grilling";
    wait-what = "${mp}/productivity/wait-what";
    writing-for-agents = "${mp}/productivity/writing-for-agents";  # retro needs it
    diagnosing-bugs = "${mp}/engineering/diagnosing-bugs";
    implement = "${mp}/engineering/implement";
    retro = "${mp}/engineering/retro";
    setup-matt-pocock-skills = "${mp}/engineering/setup-matt-pocock-skills";
    tdd = "${mp}/engineering/tdd";
    to-spec = "${mp}/engineering/to-spec";
    to-tickets = "${mp}/engineering/to-tickets";
    # addyosmani/agent-skills
    source-driven-development = "${addy}/source-driven-development";
    gh-stack = ./skills/gh-stack;
    # The upstream CLI skills also provide annotate --gate for Codex and Grok.
    plannotator = "${inputs.plannotator}/apps/skills/core/plannotator";
    plannotator-annotate = "${inputs.plannotator}/apps/skills/core/plannotator-annotate";
    plannotator-last = "${inputs.plannotator}/apps/skills/core/plannotator-last";
    plannotator-review = "${inputs.plannotator}/apps/skills/core/plannotator-review";
    hunk-review = ./skills/hunk-review;
    # cursor/plugins pstack
    create-verification-skill = "${pstack}/create-verification-skill";
    maintain-verification-skill = "${pstack}/maintain-verification-skill";
    typescript-best-practices = typescriptSkill;
    # personal
    firstmate-home-sync = ./skills/firstmate-home-sync;
    herdr-app = ./skills/herdr-app;
    herdr-core = ./skills/herdr-core;
  };
in

{
  home.file = lib.concatMapAttrs (name: src: {
    ".agents/skills/${name}".source = src;
    ".claude/skills/${name}".source = src;
  }) skills;
}
