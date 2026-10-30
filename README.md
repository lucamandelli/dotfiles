# dotfiles

My Mac and Ubuntu setup, managed with home-manager (plus nix-darwin on the Mac).

## What it sets up

- Both: zsh (autosuggestions, syntax highlighting, menu completion, shared history), starship,
  neovim (LazyVim starter) with ripgrep and fd, mise (Node, Python, Bun, pi, gh-axi,
  chrome-devtools-axi, lavish-axi, quota-axi, tasks-axi), herdr, grok, codex, no-mistakes,
  Hunk (live agent review) and tuicr (PR review),
  JetBrains Mono Nerd Font, Ghostty config, Claude settings (merged, not linked) and one shared `home/AGENTS.md`
- Mac only: macOS defaults and Homebrew casks via `configuration.nix` (1Password CLI, Cursor, Ghostty, Grok Bot)
- Ubuntu: GUI and system apps come from apt (Chrome, 1Password, Ghostty, zsh, Docker, keyd); GNOME shortcuts and clipboard history via `linux.nix`

## Layout

- `flake.nix` - entry point; `darwinConfigurations.mac` and `homeConfigurations.linux`
- `configuration.nix` - Mac system config; `hostPlatform = "x86_64-darwin"`
- `home.nix` - shared user config and out-of-store symlinks
- `linux.nix` - Ubuntu-only home-manager bits
- `home/skills.nix` - global agent skills (see below)
- `home/review-tools.nix` - Hunk and tuicr from the flake (Ubuntu, imported by `linux.nix`)
- `home/review-tools-mac.nix` - Hunk and tuicr release binaries (Mac, imported by `flake.nix`)
- `home/` - the real config files, symlinked into `~` (edit here, no rebuild needed)
- `etc/` - system files outside `~` (keyd), linked by hand on Ubuntu
- `rebuild.sh` - links the repo to `~/.dotfiles` and switches the right config for the OS

## Usage

```sh
git clone https://github.com/lucamandelli/dotfiles.git ~/github/lucamandelli/dotfiles
cd ~/github/lucamandelli/dotfiles
./rebuild.sh
```

Needs Nix (Determinate installer) first, plus nix-darwin on the Mac. Rebuild installs the configured mise tools automatically; rerun it if installation fails.
Only rerun `./rebuild.sh` for changes that are not plain symlinked files.

## Firstmate

See [firstmate.md](firstmate.md) for the isolated setup and machine sync.

## Global agent skills

`home/skills.nix` links each skill into `~/.agents/skills` (Pi, Codex, Grok) and `~/.claude/skills` (Claude Code, Grok). Upstream sources: `mattpocock-skills`, `addy-skills`, `cursor-plugins` (`flake = false`, pinned in `flake.lock`), plus `hunk-review` from the Hunk input (refreshed on rebuild). Personal skills live in `home/skills/<name>/` and are listed in the same set. The `no-mistakes` skill and Claude's `synced/` dir sit alongside, unmanaged by home-manager.

- Add an upstream skill: put `name = "${src}/path/to/skill-dir";` in the `skills` set (name must match the skill's `name:` and not collide). Link the whole dir, so bundled files travel. Check the skill has no `../` references to repo-level files, and add any skills it depends on. For a new source, add a `flake = false` input in `flake.nix`.
- Add a personal skill: create `home/skills/<name>/` (self-contained, no `../` references) and add `name = ./skills/<name>;`. The directory name, the attr name, and `name:` must match.
- Remove: delete its line. Home-manager removes the links on the next switch.
- Update sources: `nix flake update mattpocock-skills addy-skills cursor-plugins`, review the `flake.lock` diff, `./rebuild.sh`.
- Dry check: `nix build .#homeConfigurations.linux.activationPackage` and `ls -l result/home-files/.agents/skills`.
- Project-scoped skills do not belong here; commit them in the repo's `.agents/skills`.
- `create-verification-skill` writes to `.cursor/skills/` by default; point it at `.agents/skills/` when invoking.

## Pi transcript display

Linked into `~/.pi/agent` (see `home.nix`): `extensions/{thinking-rail,code-box,session-chrome}.ts`, `pi-cc-extensions.json`, and the `tokyo-quota` theme tweaks (`userMessageBg`, `mdQuoteBorder`). Tool rows come from the `pi-cc-extensions` package (mode `on`, its footer, editor prefix and startup header off).

- Rebuild merges `quietStartup: true`, the `tokyo-quota` theme, `npm:pi-cc-extensions`, `npm:pi-claude-auth` and `npm:@plannotator/pi-extension` into `~/.pi/agent/settings.json`. It sets Anthropic and `claude-opus-5-5` as defaults, configures the enabled Anthropic, OpenAI and xAI models listed in `home/.pi/agent/settings.base.json`, and disables the Anthropic extra usage warning. Other settings and packages are preserved; if Pi is available, rebuild runs `pi update --extensions`. Without `quietStartup`, Pi's own `[Skills]`/`[Extensions]` listing shows next to our header.
- Logins are per machine and never synced: use `/login` for Anthropic, OpenAI and xAI; Pi stores credentials in `~/.pi/agent/auth.json`. For `pi-claude-auth`, install and authenticate Claude Code and run `claude` at least once on each machine.
- `code-box.ts` (code frame) and `session-chrome.ts` (`❯` prompt) patch private Pi/pi-tui prototypes on `session_start`, restore on `session_shutdown`, and fall back to native rendering if the method shape differs. `pi-cc-extensions` patches private components too; after a Pi upgrade that breaks one, remove it from `packages` or delete the file link. Rebuild adds the package back.
- Known package quirks: expanded tool output (ctrl+o) uses the package's green/red boxes, and at narrow widths a truncated error line can leak a cut ANSI sequence.

## Code review

Both tools go live after `git pull && ./rebuild.sh`. No extensions, global pager or difftool changes.

- **Hunk, local work with an agent:** run `hunk diff` in the worktree, or `hunk diff main...HEAD` for committed changes. In Pi, Claude Code, Codex or Grok, ask: "Use hunk-review to walk me through this session. Explain your changes with inline notes on the hunks, and answer my comments." The agent navigates and annotates the live diff, without adding explanation comments to source files. Press `a` to show agent notes if hidden; `c` adds your question. To include human questions, the agent reads `hunk session comment list --repo /absolute/worktree/path --type all --json` (the default omits human notes).
- **tuicr, colleagues' PRs or other diffs:** from a clone with authenticated `gh`, run `tuicr pr <n>`; `tuicr -w` reviews local changes. Add anchored comments with `c`, mark files/hunks reviewed with `r`/`R`, then `y` or `:clip` exports Markdown to paste into the agent and ask whether the code makes sense. `:submit` is separate: it posts a GitHub review, so check the target/head first.

**Ubuntu** builds both from the flake (`home/review-tools.nix`, imported by `linux.nix`); `rebuild.sh` runs `nix flake update --flake "$DIR" hunk tuicr` before its switch. These inputs track upstream's default branches, not release tags; their lock entries refresh on each rebuild, with no manual version bumps. This keeps the install declarative and avoids another installer or release-discovery dependency, but can include unreleased changes or upstream build breakage.

**Intel Mac** must not build them: there is no binary cache, so Nix compiles bun, zig and rust (1300+ derivations, minutes of full CPU). `home/review-tools-mac.nix` (imported only by the Mac in `flake.nix`) downloads the upstream release binaries into `~/.local/bin` once. Upgrade: bump the versions in that file, delete `~/.local/bin/{hunk,tuicr}`, rerun the switch. `rebuild.sh` skips the flake update on the Mac.

**Rule for agents:** a tool added for Linux can silently become a source build on the Mac, and the Mac is the one that suffers. Before committing a new tool, check both. On the Mac, `nix build .#darwinConfigurations.mac.system --dry-run` must not list the tool, rust, zig or bun among "will be built" (a handful of derivations is normal). On Linux, `nix eval .#homeConfigurations.linux.activationPackage.drvPath` must still evaluate; the Mac dry-run queries the `x86_64-darwin` cache and is not verified from Linux, so from Linux say the Mac check is pending. If one OS needs a different install path, keep the existing file for one OS and add a separate `*-mac.nix` or `*-linux.nix`, imported only from that OS's entry point, instead of branching inside one file. Install preference: nixpkgs when it has a cache hit, then mise, then an install-once activation like herdr/grok/codex.

Other top-level inputs stay locked. The update may change `flake.lock`; review and commit it before pulling again. Network access is required.

The Intel Mac uses the existing 26.05 nixpkgs plus Hunk's documented systems override; the four-system list is pinned because its newer default dropped Intel macOS. Hunk's skill follows the same source as its binary. No tuicr config is needed: it inherits `EDITOR=nvim`. Review data stays per-machine, outside git; any future config belongs under `~/.config`, not `~/config`.

Sources: [Hunk Nix module](https://github.com/modem-dev/hunk/blob/main/nix/README.md), [live review skill](https://github.com/modem-dev/hunk/blob/main/packages/hunk/skills/hunk-review/SKILL.md), [tuicr usage](https://github.com/agavra/tuicr/blob/main/README.md).

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
- no-mistakes uses the upstream release binary in `~/.no-mistakes/bin`, linked from `~/.local/bin`. The switch bootstraps missing skills from the installed release in both agent skill directories; existing binaries and skill directories are left untouched. `no-mistakes init` refreshes the skills when setting up a repository. `no-mistakes update` updates the binary and restarts its daemon, so coordinate with other users of that daemon first. The upstream installer also restarts the daemon, so the switch downloads the release directly instead. No cleanup is needed for existing no-mistakes installs or real skill directories.
- `~/.claude/settings.json` is not a symlink: the switch merges `home/.claude/settings.base.json` over it, so plugins and model changed by Claude Code stay out of git. Removing a key from the base does not remove it from the live file.
- First `nvim` launch installs LazyVim plugins (needs network once).
