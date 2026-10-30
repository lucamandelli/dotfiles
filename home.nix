{ config, lib, pkgs, user, ... }:

let
  dotfiles = "${config.home.homeDirectory}/.dotfiles";
  link = path: config.lib.file.mkOutOfStoreSymlink "${dotfiles}/home/${path}";
  # SSH keys live in 1Password ("GitHub SSH" in Personal); its agent serves them.
  sshAgent = if pkgs.stdenv.isDarwin
    then "\"~/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock\""
    else "~/.1password/agent.sock";
  sshKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMWTv2iGH+sPGHBLjMe/Bp/O7PD7puqqP/He3PCg9zYB";
  sshSigner = if pkgs.stdenv.isDarwin
    then "/Applications/1Password.app/Contents/MacOS/op-ssh-sign"
    else "/opt/1Password/op-ssh-sign";
in

{
  imports = [ ./home/skills.nix ];

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
  home.sessionPath = [ "$HOME/.local/bin" "$HOME/.grok/bin" ];

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
    initContent = lib.mkMerge [
      (lib.mkOrder 550 ''
        fpath+=(~/.grok/completions/zsh)  # grok writes its completions here
      '')
      ''
        zstyle ':completion:*' menu select  # Tab opens a navigable menu
        zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'  # smart case: lowercase matches both
      ''
    ];
    shellAliases = {
      ccd = "claude --dangerously-skip-permissions";
      ccr = "claude --resume";
    };
  };

  programs.git = {
    enable = true;
    settings = {
      user = {
        name = "Luca Mandelli";
        email = "luca.part.mand@gmail.com";
      };
      init.defaultBranch = "main";
      push.autoSetupRemote = true;  # first push needs no -u
      pull.rebase = true;
      url."git@github.com:".insteadOf = "https://github.com/";  # GitHub always over SSH
      gpg.ssh.allowedSignersFile = "${config.home.homeDirectory}/.ssh/allowed_signers";  # git log --show-signature
    };
    signing = {
      format = "ssh";
      key = sshKey;
      signer = sshSigner;
      signByDefault = true;
    };
  };

  programs.ssh = {
    enable = true;
    enableDefaultConfig = false;
    settings."*".IdentityAgent = sshAgent;
  };
  home.file.".ssh/allowed_signers".text = "${config.programs.git.settings.user.email} ${sshKey}\n";

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

  # grok is not in nixpkgs; install it once, then `grok update` keeps it current.
  # SHELL=sh stops the installer from appending its PATH block to the managed ~/.zshrc.
  home.activation.installGrok = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    if [ ! -x "$HOME/.grok/bin/grok" ]; then
      PATH="${lib.makeBinPath [ pkgs.curl pkgs.gawk pkgs.gnused pkgs.gnugrep pkgs.coreutils ]}:$PATH" SHELL=/bin/sh \
        run ${pkgs.bash}/bin/bash -c '${pkgs.curl}/bin/curl -fsSL https://x.ai/cli/install.sh | bash' \
        || echo "grok install failed, rerun the switch to retry"
    fi
  '';

  # Use the upstream release, without the installer's daemon restart.
  home.activation.installNoMistakes = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    PATH="${lib.makeBinPath [ pkgs.curl pkgs.gawk pkgs.gnutar pkgs.gzip pkgs.coreutils ]}:$PATH" \
      run ${pkgs.bash}/bin/bash ${./home/install-no-mistakes.sh} \
      || echo "no-mistakes install failed, rerun the switch to retry"
  '';

  # codex is not in nixpkgs; install it once, then `codex update` keeps it current.
  # ~/.local/bin on PATH stops the installer from appending its PATH block to the managed ~/.zshrc.
  home.activation.installCodex = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    if [ ! -x "$HOME/.local/bin/codex" ]; then
      PATH="$HOME/.local/bin:${lib.makeBinPath [ pkgs.curl pkgs.gawk pkgs.gnused pkgs.gnugrep pkgs.gnutar pkgs.gzip pkgs.findutils pkgs.coreutils ]}:$PATH" CODEX_NON_INTERACTIVE=1 \
        run ${pkgs.bash}/bin/bash -c '${pkgs.curl}/bin/curl -fsSL https://chatgpt.com/codex/install.sh | sh' \
        || echo "codex install failed, rerun the switch to retry"
    fi
  '';

  # Claude Code rewrites settings.json at runtime (plugins, model), so it can't be a symlink into
  # the repo. Merge the fixed settings over the live file instead: base wins, other keys survive.
  # Before checkLinkTargets so the old symlink is replaced by a regular file first.
  home.activation.mergeClaudeSettings = lib.hm.dag.entryBefore [ "checkLinkTargets" ] ''
    settings="$HOME/.claude/settings.json"
    base="${dotfiles}/home/.claude/settings.base.json"
    merged="$(mktemp)"
    mkdir -p "$HOME/.claude"
    if [ -e "$settings" ]; then
      ${pkgs.jq}/bin/jq -s '.[0] * .[1]' "$settings" "$base" > "$merged"
    else
      cp "$base" "$merged"
    fi
    if [ -L "$settings" ] || ! cmp -s "$merged" "$settings"; then
      run mv -f "$merged" "$settings"
    else
      rm -f "$merged"
    fi
  '';

  # Pi owns its live settings; merge fixed keys without replacing machine-local packages.
  home.activation.mergePiSettings = lib.hm.dag.entryAfter [ "linkGeneration" ] ''
    settings="$HOME/.pi/agent/settings.json"
    base="${dotfiles}/home/.pi/agent/settings.base.json"
    merged="$(mktemp)"
    mkdir -p "$HOME/.pi/agent"
    if [ -e "$settings" ]; then
      input="$settings"
    else
      input=/dev/null
    fi
    ${pkgs.jq}/bin/jq -s '(.[0] // {}) as $live | .[-1] as $base |
      ($live * $base) | .packages = reduce $base.packages[] as $p
        ($live.packages // []; if index($p) == null then . + [$p] else . end)' "$input" "$base" > "$merged"
    if [ -L "$settings" ] || ! cmp -s "$merged" "$settings"; then
      run mv -f "$merged" "$settings"
    else
      rm -f "$merged"
    fi
    # Bootstrap Node first so npm-backed tools work even on a fresh machine.
    # Use the store path: nix-darwin does not necessarily have ~/.nix-profile.
    mise=${config.programs.mise.package}/bin/mise
    export PATH="${lib.makeBinPath [ config.programs.mise.package pkgs.bash pkgs.coreutils pkgs.curl pkgs.git pkgs.gnutar pkgs.gzip pkgs.xz pkgs.unzip ]}:$PATH"
    if run "$mise" install node && run "$mise" exec node -- "$mise" install; then
      run "$mise" exec -- pi update --extensions || echo "Pi extension update failed, rerun ./rebuild.sh to retry"
    else
      echo "mise install failed, rerun ./rebuild.sh to retry"
    fi
  '';

  # ~/.config/herdr used to link the whole dir; home-manager won't drop that link on its own
  # and would write config.toml's link through it into the repo, a symlink loop.
  home.activation.unlinkHerdrDir = lib.hm.dag.entryBefore [ "checkLinkTargets" ] ''
    if [ -L "$HOME/.config/herdr" ]; then
      run rm "$HOME/.config/herdr"
      run mkdir -p "$HOME/.config/herdr"
      run find "${dotfiles}/home/.config/herdr" -mindepth 1 -maxdepth 1 ! -name config.toml \
        -exec mv {} "$HOME/.config/herdr/" \;
    fi
  '';

  # Edit-in-place: the real file stays in my repo, ~/.config just points at it.
  home.file.".config/nvim".source = link ".config/nvim";
  home.file.".config/ghostty".source = link ".config/ghostty";
  home.file.".config/mise".source = link ".config/mise";
  home.file.".config/starship.toml".source = link ".config/starship.toml";
  home.file.".config/herdr/config.toml".source = link ".config/herdr/config.toml";  # file only: the dir holds runtime state
  home.file.".claude/statusline.sh".source = link ".claude/statusline.sh";

  # One source of truth for global agent rules.
  home.file.".claude/CLAUDE.md".source = link "AGENTS.md";
  home.file.".codex/AGENTS.md".source = link "AGENTS.md";
  home.file.".pi/agent/AGENTS.md".source = link "AGENTS.md";

  # Pi footer/statusline + prompt rail; the theme is set by mergePiSettings.
  home.file.".pi/agent/extensions/footer.ts".source = link ".pi/agent/extensions/footer.ts";
  home.file.".pi/agent/themes/tokyo-quota.json".source = link ".pi/agent/themes/tokyo-quota.json";
  # Transcript display: thinking rail, code frame, session header/prompt (needs `quietStartup: true`, see README).
  home.file.".pi/agent/extensions/thinking-rail.ts".source = link ".pi/agent/extensions/thinking-rail.ts";
  home.file.".pi/agent/extensions/code-box.ts".source = link ".pi/agent/extensions/code-box.ts";
  home.file.".pi/agent/extensions/session-chrome.ts".source = link ".pi/agent/extensions/session-chrome.ts";
  # Config for the pi-cc-extensions package (tool rows only; its footer/editor/header are off).
  home.file.".pi/agent/pi-cc-extensions.json".source = link ".pi/agent/pi-cc-extensions.json";

  # Global Pi MCP config (Playwright, headless). Symlinked so `pi mcp add` and /mcp edits write back here. No credentials.
  home.file.".pi/agent/mcp.json".source = link ".pi/agent/mcp.json";
}
