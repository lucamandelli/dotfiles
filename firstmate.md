# Firstmate setup

[Firstmate](https://github.com/kunchenguid/firstmate) is a repo of instructions, skills and scripts, not a global installation. Keep its code at `~/github/firstmate`: its internal skills stay in `.agents/skills/` and its Pi extensions in `.pi/extensions/`. This keeps Firstmate-specific behavior scoped to its project. Global dotfiles skills, including `firstmate-home-sync`, remain available separately.

The private operational home uses layout A: the private `lucamandelli/firstmate-home` repo has a separate bare Git directory at `~/.firstmate-home.git`, with its worktree in the code clone and sparse patterns `/data/` and `/config/`. The code clone's Git remains separate, so code updates and private home sync use different repositories without a second home directory. `config/home-sync.sh` handles home push and pull; `state/` and `projects/` are local, not synced. On this machine the bare repo has `status.showUntrackedFiles=all` and `sparse.expectFilesOutsideOfPatterns=true`; the sync skill's first-time instructions instead specify `status.showUntrackedFiles=no`. Follow the private home README for new setups rather than copying these live settings blindly.

## New machine, including Mac

1. Set up these dotfiles and run `mise install` as in the [README](README.md#usage). They provide Pi and Node via mise, `jq` and Herdr; Git and authenticated `gh` are also needed.
2. Clone Firstmate and authenticate GitHub, following its [quick start](https://github.com/kunchenguid/firstmate#install-and-launch):

   ```sh
   gh auth login
   git clone https://github.com/kunchenguid/firstmate ~/github/firstmate
   ```

3. Follow the layout A first-time instructions in the private home README, as directed by the global [firstmate-home-sync skill](home/skills/firstmate-home-sync/SKILL.md). Run its command blocks and complete the initial pull before starting Firstmate. Do not run the home on two machines at once.
4. Check the [toolchain](https://github.com/kunchenguid/firstmate/blob/main/docs/configuration.md#toolchain). Treehouse, no-mistakes and the required `-axi` CLIs are not installed by these dotfiles; install or update them separately. Backend requirements vary: Herdr needs Herdr, `jq` and Treehouse; the default tmux backend needs tmux and Treehouse. Firstmate reports missing or outdated tools at session start.
5. Start Pi as below and approve its project trust prompt once for this clone. Pi then auto-loads the tracked project extensions, including the primary watcher; do not install them globally. Local untracked extensions are machine-specific and do not come from the clone. See [Firstmate's launch instructions](https://github.com/kunchenguid/firstmate#install-and-launch).

## Each session

After the arrival pull, start from the clone without `FM_HOME`:

```sh
cd ~/github/firstmate
pi
```

Before leaving or arriving, follow [firstmate-home-sync](home/skills/firstmate-home-sync/SKILL.md) and the private home README it references. Leave and push before pulling or starting on the other machine. See [Firstmate configuration](https://github.com/kunchenguid/firstmate/blob/main/docs/configuration.md) for home and backend semantics.
