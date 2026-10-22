# dotfiles

My Mac and Ubuntu setup, managed with home-manager (plus nix-darwin on the Mac).
Based on [kunchenguid/dotfiles](https://github.com/kunchenguid/dotfiles).

## What it sets up

- Both: zsh (autosuggestions, syntax highlighting, menu completion, shared history), starship,
  neovim (LazyVim starter) with ripgrep and fd, mise (Node, Python, Bun, pi), herdr,
  JetBrains Mono Nerd Font, Ghostty config, Claude settings and one shared `home/AGENTS.md`
- Mac only: macOS defaults and Homebrew casks via `configuration.nix`
- Ubuntu: GUI and system apps come from apt (Chrome, 1Password, Ghostty, zsh)

## Layout

- `flake.nix` - entry point; `darwinConfigurations.mac` and `homeConfigurations.linux`
- `configuration.nix` - Mac system config; `hostPlatform = "x86_64-darwin"`
- `home.nix` - shared user config and out-of-store symlinks
- `linux.nix` - Ubuntu-only home-manager bits
- `home/` - the real config files, symlinked into `~` (edit here, no rebuild needed)
- `rebuild.sh` - links the repo to `~/.dotfiles` and switches the right config for the OS

## Usage

```sh
git clone https://github.com/lucamandelli/dotfiles.git ~/github/lucamandelli/dotfiles
cd ~/github/lucamandelli/dotfiles
./rebuild.sh
mise install
```

Needs Nix (Determinate installer) first, plus nix-darwin on the Mac.

On Ubuntu, Super+C/V copy/paste needs keyd (system-wide, outside home-manager):

```sh
sudo apt install keyd
sudo ln -sfn ~/github/lucamandelli/dotfiles/etc/keyd/default.conf /etc/keyd/default.conf
sudo systemctl restart keyd   # the CLI is keyd.rvaiya on Ubuntu, not keyd
```
Only rerun `./rebuild.sh` for changes that are not plain symlinked files.

## Notes

- `homebrew.onActivation.cleanup = "zap"` removes any Homebrew package not listed in `configuration.nix`, including its data.
- Existing files in the way of a symlink are renamed to `*.backup`.
- `ccd` alias runs `claude --dangerously-skip-permissions`.
- herdr is installed once by the switch; `herdr update` keeps it current.
- First `nvim` launch installs LazyVim plugins (needs network once).
