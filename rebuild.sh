#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ln -sfn "$DIR" ~/.dotfiles

if [ "$(uname -s)" = Darwin ]; then
  exec sudo -H /run/current-system/sw/bin/darwin-rebuild switch --flake ~/.dotfiles#mac
else
  # a shell opened before Nix was installed doesn't have it on PATH yet
  command -v nix >/dev/null || . /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
  exec nix run github:nix-community/home-manager/release-26.05 -- switch -b backup --flake ~/.dotfiles#linux
fi
