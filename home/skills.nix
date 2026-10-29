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
    # Hunk's live review skill, from the same pinned source as the binary.
    hunk-review = "${inputs.hunk}/packages/hunk/skills/hunk-review";
    # cursor/plugins pstack
    create-verification-skill = "${pstack}/create-verification-skill";
    maintain-verification-skill = "${pstack}/maintain-verification-skill";
    typescript-best-practices = typescriptSkill;
  };
in

{
  home.file = lib.concatMapAttrs (name: src: {
    ".agents/skills/${name}".source = src;
    ".claude/skills/${name}".source = src;
  }) skills;
}
