{
  description = "dotfiles";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-26.05-darwin";
    nixpkgs-linux.url = "github:NixOS/nixpkgs/nixos-26.05";
    nix-darwin.url = "github:nix-darwin/nix-darwin/nix-darwin-26.05";
    nix-darwin.inputs.nixpkgs.follows = "nixpkgs";

    home-manager.url = "github:nix-community/home-manager/release-26.05";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";

    nix-homebrew.url = "github:zhaofengli/nix-homebrew";

    # Review tools track upstream; rebuild.sh refreshes only these inputs.
    # Keep 26.05 nixpkgs and the four-system list for the Intel Mac.
    # https://github.com/modem-dev/hunk/blob/main/nix/README.md
    hunk = {
      url = "github:modem-dev/hunk";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.systems.url = "github:nix-systems/default/da67096a3b9bf56a91d16901293e51ba5b49a27e";
    };
    tuicr = {
      url = "github:agavra/tuicr";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    # Agent skill sources, pinned in flake.lock; linked by home/skills.nix.
    mattpocock-skills = { url = "github:mattpocock/skills"; flake = false; };
    addy-skills = { url = "github:addyosmani/agent-skills"; flake = false; };
    cursor-plugins = { url = "github:cursor/plugins"; flake = false; };
  };

  outputs = inputs@{ self, nix-darwin, nix-homebrew, home-manager, nixpkgs, nixpkgs-linux, ... }:
    let
      # The one username line to change if this isn't your machine.
      user = "lucamandelli";
    in
    {
      darwinConfigurations."mac" = nix-darwin.lib.darwinSystem {
        specialArgs = { inherit user; };
        modules = [
          ./configuration.nix
          nix-homebrew.darwinModules.nix-homebrew
          home-manager.darwinModules.home-manager
          {
            home-manager.useGlobalPkgs = true;
            home-manager.useUserPackages = true;
            home-manager.backupFileExtension = "backup";  # existing ~/.zshrc -> ~/.zshrc.backup
            home-manager.extraSpecialArgs = { inherit user inputs; };
            home-manager.users.${user}.imports = [ ./home.nix ./home/review-tools-mac.nix ];
          }
        ];
      };

      # Ubuntu: standalone home-manager, system apps stay on apt.
      homeConfigurations."linux" = home-manager.lib.homeManagerConfiguration {
        pkgs = import nixpkgs-linux { system = "x86_64-linux"; config.allowUnfree = true; };
        extraSpecialArgs = { inherit user inputs; };
        modules = [ ./home.nix ./linux.nix ];
      };
    };
}
