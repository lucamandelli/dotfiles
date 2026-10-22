#!/usr/bin/env bash
# Claude Code status line: model · effort | ctx | 5h/7d usage limits | git branch.
# Reads session JSON on stdin, schema: https://code.claude.com/docs/en/statusline#available-data
# Segments whose data is absent (no rate limits on API keys, no git repo) are skipped.

input=$(cat)

# \x1f (non-whitespace) keeps empty fields in place, unlike tabs.
IFS=$'\x1f' read -r model effort ctx five five_reset seven seven_reset dir < <(
  jq -r '[
    .model.display_name,
    .effort.level,
    .context_window.used_percentage,
    .rate_limits.five_hour.used_percentage,
    .rate_limits.five_hour.resets_at,
    .rate_limits.seven_day.used_percentage,
    .rate_limits.seven_day.resets_at,
    (.workspace.current_dir // .cwd)
  ] | map(. // "" | tostring) | join("\u001f")' <<<"$input"
)

dim=$'\e[2m' reset=$'\e[0m'
sep=" ${dim}|${reset} "

# Percentage colored green < 50, yellow < 80, red otherwise.
pct() {
  local v
  v=$(printf '%.0f' "$1")
  local color=$'\e[32m'
  ((v >= 50)) && color=$'\e[33m'
  ((v >= 80)) && color=$'\e[31m'
  printf '%s%s%%%s' "$color" "$v" "$reset"
}

# Epoch to local time. GNU date (Linux) takes @epoch; BSD date (macOS) takes -r epoch.
at() {
  date -d "@$1" "+$2" 2>/dev/null || date -r "$1" "+$2"
}

out=$model
[ -n "$effort" ] && out+=" ${dim}·${reset} $effort"
[ -n "$ctx" ] && out+="${sep}ctx $(pct "$ctx")"
if [ -n "$five" ]; then
  out+="${sep}5h $(pct "$five")"
  [ -n "$five_reset" ] && out+=" ${dim}($(at "$five_reset" %H:%M))${reset}"
fi
if [ -n "$seven" ]; then
  out+="${sep}7d $(pct "$seven")"
  [ -n "$seven_reset" ] && out+=" ${dim}($(at "$seven_reset" '%d/%m %H:%M'))${reset}"
fi

if branch=$(git -C "$dir" --no-optional-locks symbolic-ref --short -q HEAD 2>/dev/null ||
  git -C "$dir" --no-optional-locks rev-parse --short HEAD 2>/dev/null); then
  [ -n "$(git -C "$dir" --no-optional-locks status --porcelain 2>/dev/null | head -1)" ] && branch+="*"
  out+="${sep}${branch}"
fi

printf '%s' "$out"
