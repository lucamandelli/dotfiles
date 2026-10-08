# dotfiles

My Mac setup, managed with nix-darwin and home-manager.
Based on [kunchenguid/dotfiles](https://github.com/kunchenguid/dotfiles), adapted for an Intel Mac.

## What it sets up

- macOS defaults and Homebrew (casks) via `configuration.nix`
- Shell (zsh, aliases, starship), Nix user packages and symlinks via `home.nix`
- Neovim, WezTerm (rose-pine moon) and herdr (terminal multiplexer) configs under `home/`
- Agent configs: Claude, Codex and opencode share one `home/AGENTS.md`; Claude settings and Pi (theme, extensions) are tracked too

## Layout

- `flake.nix` - entry point; declares the `mac` machine and the `user`
- `configuration.nix` - system config; `hostPlatform = "x86_64-darwin"`
- `home.nix` - user config and out-of-store symlinks
- `home/` - the real config files, symlinked into `~` (edit here, no rebuild needed)
- `install-tools.sh` - Intel workaround, see below
- `rebuild.sh` - links the repo to `~/.dotfiles` and runs `darwin-rebuild switch`

## Usage

```sh
git clone https://github.com/lucamandelli/dotfiles.git ~/github/lucamandelli/dotfiles
cd ~/github/lucamandelli/dotfiles
./rebuild.sh
```

Needs Nix and nix-darwin installed first. After that, `./rebuild.sh` is the only command.
Only run it for changes that are not plain symlinked files (packages, system defaults, `install-tools.sh`).

## Intel workaround

Homebrew no longer ships bottles for Intel, so formulas like herdr and bun compile from source and take forever.
`install-tools.sh` runs on every switch (`postActivation`) and installs prebuilt binaries from upstream instead:

| Tool | Source | Mode |
| --- | --- | --- |
| herdr | herdr.dev installer | reinstall (latest) |
| bun | bun.sh installer | reinstall (latest) |
| gh | GitHub release zip | reinstall (latest) |
| pyenv | git clone | keep if present |
| nvm | nvm installer | keep if present |

It needs internet, never aborts the switch on failure, and logs to `/tmp/install-tools-<name>.log`.
pyenv and nvm are never wiped because they hold installed versions.

## Notes

- `homebrew.onActivation.cleanup = "zap"` removes any Homebrew package not listed in `configuration.nix`.
- Existing files in the way of a symlink are renamed to `*.backup`.
- `cc` alias runs `claude --dangerously-skip-permissions`.
- First `nvim` launch clones plugins via lazy.nvim (needs network once).
