# dotfiles

My Mac and Ubuntu setup, managed with home-manager (plus nix-darwin on the Mac).

## What it sets up

- Both: zsh (autosuggestions, syntax highlighting, menu completion, shared history), starship,
  neovim (LazyVim starter) with ripgrep and fd, mise (Node, Python, Bun, pi), herdr, grok, codex,
  JetBrains Mono Nerd Font, Ghostty config, Claude settings (merged, not linked) and one shared `home/AGENTS.md`
- Mac only: macOS defaults and Homebrew casks via `configuration.nix`
- Ubuntu: GUI and system apps come from apt (Chrome, 1Password, Ghostty, zsh, Docker, keyd); GNOME shortcuts and clipboard history via `linux.nix`

## Layout

- `flake.nix` - entry point; `darwinConfigurations.mac` and `homeConfigurations.linux`
- `configuration.nix` - Mac system config; `hostPlatform = "x86_64-darwin"`
- `home.nix` - shared user config and out-of-store symlinks
- `linux.nix` - Ubuntu-only home-manager bits
- `home/` - the real config files, symlinked into `~` (edit here, no rebuild needed)
- `etc/` - system files outside `~` (keyd), linked by hand on Ubuntu
- `rebuild.sh` - links the repo to `~/.dotfiles` and switches the right config for the OS

## Usage

```sh
git clone https://github.com/lucamandelli/dotfiles.git ~/github/lucamandelli/dotfiles
cd ~/github/lucamandelli/dotfiles
./rebuild.sh
mise install
```

Needs Nix (Determinate installer) first, plus nix-darwin on the Mac.
Only rerun `./rebuild.sh` for changes that are not plain symlinked files.

## Ubuntu system setup

Everything outside `~` comes from apt, using the vendor's own repo when there is one.
Run once, in this order, before `./rebuild.sh`.

Base tools and the GitHub CLI:

```sh
sudo apt update && sudo apt install -y git curl gpg ca-certificates
sudo mkdir -p -m 755 /etc/apt/keyrings
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | sudo tee /etc/apt/sources.list.d/github-cli.list
```

1Password (app and CLI), with package signature verification:

```sh
curl -fsSL https://downloads.1password.com/linux/keys/1password.asc \
  | sudo gpg --dearmor --yes -o /usr/share/keyrings/1password-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/1password-archive-keyring.gpg] https://downloads.1password.com/linux/debian/amd64 stable main" \
  | sudo tee /etc/apt/sources.list.d/1password.list
sudo mkdir -p /etc/debsig/policies/AC2D62742012EA22 /usr/share/debsig/keyrings/AC2D62742012EA22
curl -fsSL https://downloads.1password.com/linux/debian/debsig/1password.pol \
  | sudo tee /etc/debsig/policies/AC2D62742012EA22/1password.pol >/dev/null
curl -fsSL https://downloads.1password.com/linux/keys/1password.asc \
  | sudo gpg --dearmor --yes -o /usr/share/debsig/keyrings/AC2D62742012EA22/debsig.gpg
```

Docker (Engine, Compose, Buildx):

```sh
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
```

Install the apps, then Chrome (its .deb registers Google's repo for updates):

```sh
sudo apt update
sudo apt install -y gh 1password 1password-cli zsh ghostty \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
curl -fsSL https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -o /tmp/chrome.deb
sudo apt install -y /tmp/chrome.deb && rm /tmp/chrome.deb
sudo usermod -aG docker "$USER"   # docker without sudo
```

Remove Firefox and keep it from coming back through the transitional package:

```sh
sudo snap remove --purge firefox
sudo apt purge -y firefox
printf 'Package: firefox\nPin: version *\nPin-Priority: -1\n' | sudo tee /etc/apt/preferences.d/no-firefox
```

Super+C/V copy/paste via keyd:

```sh
sudo apt install -y keyd
sudo ln -sfn ~/github/lucamandelli/dotfiles/etc/keyd/default.conf /etc/keyd/default.conf
sudo systemctl restart keyd   # the CLI is keyd.rvaiya on Ubuntu, not keyd
```

OpenWhispr (voice dictation). No apt repo, so the official .deb; it updates itself.
Its postinst adds you to the `input` group and enables `ydotoold` so it can paste on Wayland.
The CUDA 12 runtime libs enable its GPU transcription (the NVIDIA driver alone isn't enough):

```sh
gh release download -R OpenWhispr/openwhispr -p '*-linux-amd64.deb' -D /tmp
sudo apt install -y /tmp/OpenWhispr-*-linux-amd64.deb libcudart12 libcublas12
rm /tmp/OpenWhispr-*-linux-amd64.deb
```

Its GNOME shortcuts (F8 dictation, Ctrl+Shift+Space voice agent) are created by the app; `linux.nix` only lists them.

Claude Desktop, from Anthropic's apt repo (key fingerprint `31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE`):

```sh
sudo curl -fsSLo /usr/share/keyrings/claude-desktop-archive-keyring.asc https://downloads.claude.ai/claude-desktop/key.asc
gpg --show-keys /usr/share/keyrings/claude-desktop-archive-keyring.asc
echo "deb [arch=amd64,arm64 signed-by=/usr/share/keyrings/claude-desktop-archive-keyring.asc] https://downloads.claude.ai/claude-desktop/apt/stable stable main" \
  | sudo tee /etc/apt/sources.list.d/claude-desktop.list
sudo apt update && sudo apt install -y claude-desktop
sudo usermod -aG kvm "$USER"   # Cowork runs its VM through /dev/kvm and /dev/vhost-vsock
```

ChatGPT (with Codex). Like Chrome, its .deb registers OpenAI's repo for updates:

```sh
curl -fsSL https://persistent.oaistatic.com/codex-app-prod/linux/deb/latest/chatgpt_amd64.deb -o /tmp/chatgpt.deb
sudo apt install -y /tmp/chatgpt.deb && rm /tmp/chatgpt.deb
```

Nix, then zsh as the login shell (run `chsh` in a real terminal, it asks for the password):

```sh
curl -fsSL https://install.determinate.systems/nix | sh -s -- install
chsh -s /usr/bin/zsh
gh auth login
```

Log out and back in afterwards: zsh, the docker group and the GNOME extensions only apply to a new session.

## Notes

- `homebrew.onActivation.cleanup = "zap"` removes any Homebrew package not listed in `configuration.nix`, including its data.
- Existing files in the way of a symlink are renamed to `*.backup`.
- `ccd` alias runs `claude --dangerously-skip-permissions`; `ccr` runs `claude --resume`.
- Ubuntu: `~/.local/bin/sudo` wraps sudo so that without a terminal (coding agents) it runs `sudo -A`, and a zenity dialog shows the command and asks for the password.
- herdr is installed once by the switch; `herdr update` keeps it current.
- grok is installed once by the switch (`~/.grok/bin`, added to PATH here); `grok update` keeps it current. Run `grok login` once per machine.
- codex is installed once by the switch (`~/.local/bin/codex`); `codex update` keeps it current. Run `codex login` once per machine.
- `~/.claude/settings.json` is not a symlink: the switch merges `home/.claude/settings.base.json` over it, so plugins and model changed by Claude Code stay out of git. Removing a key from the base does not remove it from the live file.
- First `nvim` launch installs LazyVim plugins (needs network once).
