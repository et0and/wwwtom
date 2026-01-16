{pkgs ? import (fetchTarball "https://github.com/NixOS/nixpkgs/tarball/nixpkgs-unstable") {}}:
let
  bun-overlay = (fetchTarball "https://github.com/oven-sh/bun-overlay/archive/main.tar.gz");
in
pkgs.mkShell {
  name = "wwwtom";

  packages = with pkgs; [
    (import bun-overlay {inherit pkgs;}).bun
    wrangler
    turbo
    typescript
    oxlint
    oxfmt
  ];

  shellHook = ''
    echo "wwwtom monorepo"
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
}
