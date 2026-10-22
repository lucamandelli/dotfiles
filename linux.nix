{ ... }:

{
  # Standalone home-manager on a non-NixOS distro (Ubuntu).
  programs.home-manager.enable = true;
  targets.genericLinux.enable = true;  # desktop entries and fonts visible to apt apps

  # US intl layout: ' + c gives ć by default; make it ç like on the Mac.
  home.file.".XCompose".text = ''
    include "%L"
    <dead_acute> <c> : "ç" ccedilla
    <dead_acute> <C> : "Ç" Ccedilla
  '';
}
