{ config, lib, pkgs, user, ... }:

let
  dotfiles = "${config.home.homeDirectory}/.dotfiles";
  link = path: config.lib.file.mkOutOfStoreSymlink "${dotfiles}/home/${path}";
in

{
  home.username = user;
  home.homeDirectory = if pkgs.stdenv.isDarwin then "/Users/${user}" else "/home/${user}";
  home.stateVersion = "24.11";
  home.packages = with pkgs; [
    neovim
    ripgrep   # LazyVim search
    fd        # LazyVim file picker
    jq        # Claude statusline
    nerd-fonts.jetbrains-mono
  ] ++ lib.optionals stdenv.isDarwin [
    gh        # on Ubuntu it comes from GitHub's apt repo
  ];
  fonts.fontconfig.enable = true;
  home.sessionVariables.EDITOR = "nvim";
  home.sessionPath = [ "$HOME/.local/bin" ];

  programs.zsh = {
    enable = true;
    autosuggestion.enable = true;      # ghost text from history
    syntaxHighlighting.enable = true;  # commands turn green when valid
    history = {
      size = 100000;
      save = 100000;
      share = true;        # shared across open terminals
      ignoreAllDups = true;
    };
    initContent = ''
      zstyle ':completion:*' menu select  # Tab opens a navigable menu
    '';
    shellAliases = {
      ccd = "claude --dangerously-skip-permissions";
    };
  };

  programs.git = {
    enable = true;
    settings.user = {
      name = "Luca Mandelli";
      email = "luca.part.mand@gmail.com";
    };
  };

  programs.starship.enable = true;

  # Node, Python, Bun and pi; versions live in home/.config/mise/config.toml.
  programs.mise.enable = true;

  # herdr is not in nixpkgs; install it once, then `herdr update` keeps it current.
  home.activation.installHerdr = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    if [ ! -x "$HOME/.local/bin/herdr" ]; then
      PATH="${lib.makeBinPath [ pkgs.curl pkgs.gawk pkgs.coreutils ]}:$PATH" \
        run ${pkgs.bash}/bin/bash -c '${pkgs.curl}/bin/curl -fsSL https://herdr.dev/install.sh | sh' \
        || echo "herdr install failed, rerun the switch to retry"
    fi
  '';

  # Edit-in-place: the real file stays in my repo, ~/.config just points at it.
  home.file.".config/nvim".source = link ".config/nvim";
  home.file.".config/ghostty".source = link ".config/ghostty";
  home.file.".config/mise".source = link ".config/mise";
  home.file.".config/starship.toml".source = link ".config/starship.toml";
  home.file.".config/herdr/config.toml".source = link ".config/herdr/config.toml";  # file only: the dir holds runtime state
  home.file.".claude/settings.json".source = link ".claude/settings.json";
  home.file.".claude/statusline.sh".source = link ".claude/statusline.sh";

  # One source of truth for global agent rules.
  home.file.".claude/CLAUDE.md".source = link "AGENTS.md";
  home.file.".codex/AGENTS.md".source = link "AGENTS.md";
}
