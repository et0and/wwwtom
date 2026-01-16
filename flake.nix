{
  description = "wwwtom";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    bun-overlay.url = "github:oven-sh/bun-overlay";
    bun-overlay.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
    bun-overlay,
  }:
    flake-utils.lib.eachDefaultSystem (system: let
      pkgs = import nixpkgs {
        inherit system;
        overlays = [bun-overlay.overlay];
      };
    in {
      devShells = {
        default = pkgs.mkShell {
          name = "wwwtom";

          packages = with pkgs; [
            bun
            wrangler
            turbo
            typescript
            oxlint
            oxfmt
          ];

          shellHook = ''
            # Verify Bun is available
            if ! command -v bun &> /dev/null; then
              echo "Error: Bun not found. Please run: nix develop"
              exit 1
            fi

            echo "Tom's monorepo development shell activated"
            echo "Available commands:"
            echo "  bun dev          - Start all dev servers"
            echo "  bun dev:web      - Start web app only"
            echo "  bun dev:api      - Start API only"
            echo "  bun build        - Build for production"
            echo "  bun deploy       - Deploy web to Cloudflare"
            echo "  bun lint         - Run linter"
            echo "  bun format       - Check formatting"
            echo "  bun write        - Auto-format"
            echo "  bun typecheck    - Type check"
            echo "  bun test         - Run tests"
          '';

          # Environment variables
          BUN_VERSION = pkgs.bun.version;
        };
      };

      packages = {
        default = self.devShells.${system}.default;
      };
    });
}
