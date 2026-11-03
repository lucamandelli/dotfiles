#!/usr/bin/env bash
set -eu

bin="$HOME/.no-mistakes/bin/no-mistakes"
link="$HOME/.local/bin/no-mistakes"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

latest=$(curl -fsSLI -o /dev/null -w '%{url_effective}' https://github.com/kunchenguid/no-mistakes/releases/latest)
version=${latest##*/}
case "$version" in v[0-9]*) ;; *) echo "no-mistakes: invalid release URL: $latest" >&2; exit 1 ;; esac
installed=$([ ! -x "$bin" ] || "$bin" --version | awk '{print $3}')
if [ "$installed" != "$version" ]; then
  case "$(uname -s)-$(uname -m)" in
    Linux-x86_64) platform=linux-amd64 ;;
    Darwin-x86_64) platform=darwin-amd64 ;;
    *) echo "no-mistakes: unsupported platform" >&2; exit 1 ;;
  esac
  curl -fsSL "https://github.com/kunchenguid/no-mistakes/releases/download/$version/no-mistakes-$version-$platform.tar.gz" -o "$tmp/release.tar.gz"
  tar xzf "$tmp/release.tar.gz" -C "$tmp"
  mkdir -p "$(dirname "$bin")"
  # Replace atomically so a running daemon keeps its existing executable.
  install -m 755 "$tmp/no-mistakes" "$bin.new"
  mv -f "$bin.new" "$bin"
fi

if [ -x "$bin" ] && [ ! -e "$link" ] && [ ! -L "$link" ]; then
  mkdir -p "$(dirname "$link")"
  ln -s "$bin" "$link"
elif [ "$(readlink "$link" 2>/dev/null || true)" != "$bin" ]; then
  echo "no-mistakes: $link already exists; point it at $bin to use the managed release" >&2
  exit 1
fi

# The upstream init command owns and refreshes these files. Only bootstrap missing
# skills, using the installed binary's release, and never replace existing ones.
if [ -x "$bin" ]; then tool=$bin; else tool=$link; fi
version=$("$tool" --version | awk '{print $3}')
case "$version" in v[0-9]*) ;; *) echo "no-mistakes: unknown version: $version" >&2; exit 1 ;; esac
for root in "$HOME/.agents/skills" "$HOME/.claude/skills"; do
  skill="$root/no-mistakes"
  if [ ! -e "$skill" ] && [ ! -L "$skill" ]; then
    curl -fsSL "https://raw.githubusercontent.com/kunchenguid/no-mistakes/$version/skills/no-mistakes/SKILL.md" -o "$tmp/SKILL.md"
    mkdir -p "$skill"
    cp "$tmp/SKILL.md" "$skill/SKILL.md"
  fi
done
