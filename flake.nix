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
            home-manager.users.${user} = import ./home.nix;
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
