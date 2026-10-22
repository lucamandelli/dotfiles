{ ... }:

{
  # Standalone home-manager on a non-NixOS distro (Ubuntu).
  programs.home-manager.enable = true;
  targets.genericLinux.enable = true;  # desktop entries and fonts visible to apt apps
}
