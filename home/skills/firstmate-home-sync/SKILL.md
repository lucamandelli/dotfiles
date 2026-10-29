---
name: firstmate-home-sync
description: Sync the private firstmate home across machines. Use when the captain is leaving a machine, arriving on a machine, switching machines, or asks to sync the firstmate home.
---

# Firstmate home sync

`data/` and `config/` travel through the private repo `lucamandelli/firstmate-home`. Firstmate's code does not. One machine is active at a time.

The private README is the authoritative procedure, including first-time command blocks. Read it and follow it when it differs from this skill:

```sh
gh api repos/lucamandelli/firstmate-home/contents/README.md --jq .content | base64 -d
```

Sync only through `<home>/config/home-sync.sh`. It detects the layout. Do not add a second sync path.

## Find the home

Done when you can name the home path and the layout, or you have confirmed neither exists (first-time setup).

1. Candidates, in order: `$FM_HOME` when set; `~/github/firstmate-home`; the work tree of `~/.firstmate-home.git` (`git --git-dir="$HOME/.firstmate-home.git" config --get core.worktree`).
2. A home contains `config/home-sync.sh`.
3. Layout B (separate clone): `git -C <home> remote get-url origin` contains `firstmate-home`. That directory is `FM_HOME`. Firstmate's code is a separate clone, usually `~/github/firstmate`.
4. Layout A (sparse checkout in the firstmate clone): otherwise, with git dir `~/.firstmate-home.git` (or `$FM_HOME_GIT`). The home is that git dir's work tree. Only `/data/` and `/config/` are checked out. Firstmate's own git is untouched.

## One machine

Leave on this machine, then arrive on the other. Never run firstmate against this home on two machines. Never pull over a session that has not pushed. `state/`, live workers, and Lavish boards stay on the machine that created them.

## Leaving

Done when `config/home-sync.sh push` prints `firstmate-home: pushed` or `firstmate-home: nothing to push`, and the firstmate session is stopped.

1. In the firstmate session, run `/stow` (memory curation and the open-work checkpoint). If this session is not firstmate, the live firstmate session runs `/stow` before the push.
2. Confirm parked work is in its report files and the backlog notes. A thread that exists only in the session is not parked. `state/` does not travel.
3. Run `<home>/config/home-sync.sh push`.
4. Stop the session. The other machine stays idle until this push finishes.

## Arriving

Done when pull has succeeded and parked work has been resumed by dispatching fresh workers from the checkpoints.

1. Before starting the firstmate session, run `<home>/config/home-sync.sh pull`.
2. Start the session. Layout A: from the firstmate clone, no `FM_HOME`. Layout B: from the code clone with `FM_HOME` set to the home (`FM_HOME=~/github/firstmate-home pi`, or that machine's alias).
3. Read the backlog notes. Dispatch fresh workers from those checkpoints. Live workers, panes, and Lavish boards did not travel.

## Switching

Leaving here, then arriving on the other machine. Finish the leaving completion criterion before anyone starts the session there.

## First-time setup

Done when `<home>/config/home-sync.sh` exists, a pull has succeeded, and no firstmate session was started before that pull.

Read the README (command above) and run its section for this machine's layout. Execute those command blocks; do not paraphrase them.

- Layout A: bare git dir `~/.firstmate-home.git`, work tree the firstmate clone, sparse checkout of `/data/` and `/config/`, `status.showUntrackedFiles no`. Start from that clone with no `FM_HOME`.
- Layout B: clone `kunchenguid/firstmate` for code and `lucamandelli/firstmate-home` for the home (for example `~/github/firstmate-home`). Set `status.showUntrackedFiles no` on the home. Start from the code folder with `FM_HOME` pointing at the home. `state/` and `projects/` are created inside the home and are never committed.

A shell alias for the layout B launch belongs on that machine only.

## What does not travel

`state/` (live workers, watcher, locks), `projects/` (clones; rebuild from `data/projects.md`), `.env`, logins (Pi, gh, quota tools), live workers, Lavish boards, and heavy binaries (browsers, fonts, videos, files over 5 MB). The sync script only adds `data/` and `config/`. Paths inside old records point at the machine that wrote them; they are history.

Work in flight does not travel. Finish, pause, or record it before switching.
