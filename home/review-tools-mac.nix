# Mac counterpart of review-tools.nix. The Intel Mac has no binary cache for Hunk/tuicr, so
# building them from the flake compiles bun, zig and rust. Install the upstream release binaries once.
# To upgrade: bump the versions, delete ~/.local/bin/{hunk,tuicr}, rerun the switch.
{ lib, pkgs, ... }:

let
  tuicrVersion = "0.28.0";
  hunkVersion = "0.24.1";
in

{
  home.activation.installTuicr = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    if [ ! -x "$HOME/.local/bin/tuicr" ]; then
      run mkdir -p "$HOME/.local/bin"
      run ${pkgs.bash}/bin/bash -c '${pkgs.curl}/bin/curl -fsSL https://github.com/agavra/tuicr/releases/download/v${tuicrVersion}/tuicr-${tuicrVersion}-x86_64-apple-darwin.tar.gz \
        | ${pkgs.gnutar}/bin/tar -xz -C "$HOME/.local/bin" tuicr' \
        || echo "tuicr install failed, rerun the switch to retry"
    fi
  '';

  home.activation.installHunk = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    if [ ! -x "$HOME/.local/bin/hunk" ]; then
      run mkdir -p "$HOME/.local/bin"
      run ${pkgs.bash}/bin/bash -c '${pkgs.curl}/bin/curl -fsSL https://github.com/modem-dev/hunk/releases/download/v${hunkVersion}/hunkdiff-darwin-x64.tar.gz \
        | ${pkgs.gnutar}/bin/tar -xz -C "$HOME/.local/bin" --strip-components=1 hunkdiff-darwin-x64/hunk' \
        || echo "hunk install failed, rerun the switch to retry"
    fi
  '';
}
