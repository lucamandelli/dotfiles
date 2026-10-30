# Firstmate setup

[Firstmate](https://github.com/kunchenguid/firstmate) is a repo of instructions, skills and scripts, not a global installation.

## Why it is set up this way

Keep code in `~/github/firstmate` and the private operational home in the separate `lucamandelli/firstmate-home` repository. Layout A uses one shared worktree: the private repo has a bare Git directory at `~/.firstmate-home.git` and checks out only `data/` and `config/`. Firstmate's code Git ignores those private directories. Code updates and home sync remain separate without a second home folder. `config/home-sync.sh` handles push and pull; `state/` and `projects/` stay local. Only one machine may run the home at a time.

Firstmate's internal skills stay in the clone's `.agents/skills/` and its Pi extensions in `.pi/extensions/`, not global agent configuration. Global dotfiles skills, including `firstmate-home-sync`, remain available separately.

The bare repo on this machine has `core.worktree=~/github/firstmate` (stored as an absolute path), `core.sparseCheckout=true`, patterns `/data/` and `/config/`, `status.showUntrackedFiles=no`, and `sparse.expectFilesOutsideOfPatterns=true`. The home repo also tracks a root `README.md`, which collides with Firstmate's README in the shared worktree. Without `sparse.expectFilesOutsideOfPatterns`, Git clears skip-worktree on the present file, reports it modified, and a pull could overwrite Firstmate's README. Protect it with:

```sh
git --git-dir=~/.firstmate-home.git config sparse.expectFilesOutsideOfPatterns true
git --git-dir=~/.firstmate-home.git update-index --skip-worktree README.md
```

Follow the private home README for the complete first-time setup.

## New machine, including Mac

1. Set up these dotfiles as in the [README](README.md#usage). They provide Pi and Node via mise, `jq` and Herdr; Git and authenticated `gh` are also needed. The rebuild merges Pi's `quietStartup`, theme and `pi-cc-extensions` settings into its machine-local settings.
2. Clone Firstmate and authenticate GitHub, following its [quick start](https://github.com/kunchenguid/firstmate#install-and-launch):

   ```sh
   gh auth login
   git clone https://github.com/kunchenguid/firstmate ~/github/firstmate
   ```

3. Follow the layout A first-time instructions in the private home README, as directed by the global [firstmate-home-sync skill](home/skills/firstmate-home-sync/SKILL.md). Run its command blocks and complete the initial pull before starting Firstmate. Do not run the home on two machines at once.
4. Check the [toolchain](https://github.com/kunchenguid/firstmate/blob/main/docs/configuration.md#toolchain). The dotfiles install no-mistakes and the required `-axi` CLIs; install Treehouse separately. Backend requirements vary: Herdr needs Herdr, `jq` and Treehouse; the default tmux backend needs tmux and Treehouse. Firstmate reports missing or outdated tools at session start.
5. Start Pi as below and approve its project trust prompt once for this clone. Pi then auto-loads the tracked project extensions, including the primary watcher; do not install them globally. Local untracked extensions are machine-specific and do not come from the clone. See [Firstmate's launch instructions](https://github.com/kunchenguid/firstmate#install-and-launch).

## Each session

After the arrival pull, start from the clone without `FM_HOME`:

```sh
cd ~/github/firstmate
pi
```

Before leaving or arriving, follow [firstmate-home-sync](home/skills/firstmate-home-sync/SKILL.md) and the private home README it references. Leave and push before pulling or starting on the other machine. See [Firstmate configuration](https://github.com/kunchenguid/firstmate/blob/main/docs/configuration.md) for home and backend semantics.
