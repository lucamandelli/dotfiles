{ config, lib, pkgs, ... }:

let
  clipboard = pkgs.gnomeExtensions.clipboard-indicator;
  workspaces = lib.range 1 9;
  perWorkspace = f: builtins.listToAttrs (map f workspaces);
in

{
  # Standalone home-manager on a non-NixOS distro (Ubuntu).
  programs.home-manager.enable = true;
  targets.genericLinux.enable = true;  # desktop entries and fonts visible to apt apps

  # US intl layout: ' + c gives ç by default; make it ç like on the Mac.
  home.file.".XCompose".text = ''
    include "%L"
    <dead_acute> <c> : "ç" ccedilla
    <dead_acute> <C> : "Ç" Ccedilla
  '';

  # GNOME's "launch terminal" action goes through xdg-terminal-exec.
  xdg.configFile."xdg-terminals.list".text = ''
    com.mitchellh.ghostty.desktop
  '';

  # Clipboard history (text and images, screenshots included) on Super+Shift+V.
  home.file.".local/share/gnome-shell/extensions/${clipboard.extensionUuid}".source =
    "${clipboard}/share/gnome-shell/extensions/${clipboard.extensionUuid}";

  # Omarchy-style Super shortcuts. Super+C/V copy/paste come from keyd (etc/keyd/default.conf).
  dconf.settings = {
    "org/gnome/shell".enabled-extensions = [
      "ding@rastersoft.com"
      "ubuntu-dock@ubuntu.com"
      "tiling-assistant@ubuntu.com"
      clipboard.extensionUuid
    ];
    "org/gnome/shell/extensions/clipboard-indicator" = {
      toggle-menu = [ "<Shift><Super>v" ];
      paste-on-select = true;
    };

    "org/gnome/settings-daemon/plugins/media-keys" = {
      terminal = [ "<Super>Return" ];          # default terminal
      www = [ "<Shift><Super>Return" ];        # default browser
      home = [ "<Shift><Super>f" ];            # file manager
      custom-keybindings = [ "/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/herdr/" ];
    };
    "org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/herdr" = {
      name = "herdr";
      binding = "<Alt><Super>Return";
      command = "xdg-terminal-exec ${config.home.homeDirectory}/.local/bin/herdr";
    };

    "org/gnome/shell/keybindings" = {
      toggle-application-view = [ "<Super>space" ];
      toggle-message-tray = [ "<Super>m" ];    # Super+V is paste now
    } // perWorkspace (n: lib.nameValuePair "switch-to-application-${toString n}" [ ]);

    # The Ubuntu dock binds Super+1..9 to its apps; workspaces get them instead.
    "org/gnome/shell/extensions/dash-to-dock".hot-keys = false;

    "org/gnome/desktop/wm/keybindings" = {
      close = [ "<Super>w" "<Alt>F4" ];
      toggle-fullscreen = [ "<Super>f" ];
      switch-input-source = [ "XF86Keyboard" ];  # Super+Space opens the app search
      switch-input-source-backward = [ ];
    }
    // perWorkspace (n: lib.nameValuePair "switch-to-workspace-${toString n}" [ "<Super>${toString n}" ])
    // perWorkspace (n: lib.nameValuePair "move-to-workspace-${toString n}" [ "<Shift><Super>${toString n}" ]);

    # Fixed workspaces so Super+1..9 always lands somewhere.
    "org/gnome/mutter".dynamic-workspaces = false;
    "org/gnome/desktop/wm/preferences".num-workspaces = 9;
  };
}
