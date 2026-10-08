#!/bin/bash
# Workaround for this Intel (x86_64) Mac: Homebrew no longer builds bottles for Intel, so
# formulas compile from source (herdr -> zig/cmake, bun -> llvm...), which takes very long.
# Instead, install the tools with upstream installers/releases, which ship prebuilt binaries.
#
# Modes:
#   reinstall - remove the binary and reinstall it (always latest); on failure the old
#               binary is restored.
#   ensure    - install only if missing. Used for tools that keep user data next to them
#               (pyenv versions, nvm versions), which must never be wiped.
#
# Always exits 0 so a failed install never aborts the nix-darwin switch.
# Usage: install-tools.sh <user>

user="$1"
home="/Users/$user"
ok=""
failed=""

# install_tool <mode> <name> <binary-path> <shell-command run as $user>
install_tool() {
  local mode="$1" name="$2" bin="$3" cmd="$4"
  local log="/tmp/install-tools-$name.log" bak had=0

  if [ "$mode" = ensure ] && [ -e "$bin" ]; then
    ok="$ok $name(kept)"
    return
  fi

  bak="$(mktemp)"
  if [ "$mode" = reinstall ] && [ -e "$bin" ]; then
    cp -p "$bin" "$bak"
    had=1
    rm -f "$bin"
  fi

  if sudo -u "$user" -H bash -c "$cmd" >"$log" 2>&1 && [ -e "$bin" ]; then
    ok="$ok $name"
  else
    if [ "$had" = 1 ]; then cp -p "$bak" "$bin"; fi
    failed="$failed $name(log: $log)"
  fi
  rm -f "$bak"
}

# GitHub CLI has no install script, only release archives.
install_gh() {
  local tmp url
  tmp="$(mktemp -d)"
  url="$(curl -fsSL https://api.github.com/repos/cli/cli/releases/latest \
    | grep -o 'https://[^"]*macOS_amd64\.zip' | head -1)"
  [ -n "$url" ] \
    && curl -fsSL "$url" -o "$tmp/gh.zip" \
    && unzip -q "$tmp/gh.zip" -d "$tmp" \
    && mkdir -p "$HOME/.local/bin" \
    && install -m 755 "$tmp"/gh_*/bin/gh "$HOME/.local/bin/gh"
  local rc=$?
  rm -rf "$tmp"
  return $rc
}

# pyenv-installer refuses to run when ~/.pyenv exists (it does, holding versions/shims),
# so clone into the existing directory instead.
install_pyenv() {
  mkdir -p "$HOME/.pyenv" \
    && git -C "$HOME/.pyenv" init -q \
    && { git -C "$HOME/.pyenv" remote add origin https://github.com/pyenv/pyenv.git 2>/dev/null || true; } \
    && git -C "$HOME/.pyenv" fetch -q --depth 1 origin master \
    && git -C "$HOME/.pyenv" checkout -q -f -B master FETCH_HEAD
}

# ~/.nvm/nvm.sh and nvm-exec were symlinks into the old brew install; drop them so the
# installer writes real files. PROFILE=/dev/null keeps the installer away from ~/.zshrc.
install_nvm() {
  rm -f "$HOME/.nvm/nvm.sh" "$HOME/.nvm/nvm-exec"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | PROFILE=/dev/null bash
}

install_tool reinstall herdr "$home/.local/bin/herdr" 'curl -fsSL https://herdr.dev/install.sh | bash'
install_tool reinstall bun   "$home/.bun/bin/bun"     'curl -fsSL https://bun.sh/install | bash'
install_tool reinstall gh    "$home/.local/bin/gh"    "$(declare -f install_gh); install_gh"
install_tool ensure    pyenv "$home/.pyenv/bin/pyenv" "$(declare -f install_pyenv); install_pyenv"
install_tool ensure    nvm   "$home/.nvm/.git"        "$(declare -f install_nvm); install_nvm"

echo "install-tools: ok=[$ok ] failed=[$failed ]"
exit 0
