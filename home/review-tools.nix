{ inputs, pkgs, ... }:

{
  imports = [ inputs.hunk.homeManagerModules.default ];

  # https://github.com/modem-dev/hunk/blob/main/nix/README.md
  programs.hunk = {
    enable = true;
    # Live agent review only; leave Git/jj pagers and difftools alone.
    enableGitIntegration = false;
    enableJujutsuIntegration = false;
    # Shared skill links are managed in skills.nix, including Claude's.
    enableClaudeIntegration = false;
  };

  home.packages = [ inputs.tuicr.packages.${pkgs.stdenv.hostPlatform.system}.default ];
  # tuicr inherits EDITOR=nvim from home.nix; no config file needed.
  # Review sessions stay in per-machine data/state, outside dotfiles.
}
