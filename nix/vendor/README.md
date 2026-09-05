Packages this tree overlays onto ekapkgs because the pin does not yet
ship them. Each is a candidate to drop when the pin grows the attribute.

- `mk-shell.nix` — `pkgs.mkShell`
- `ripgrep.nix` — `rg` on the packaged Claude adapter's PATH
- `nixpkgs-fmt.nix` — formatter this tree already uses (ekapkgs ships nixfmt)
- `fonts/` — hosted typefaces not in ekapkgs (the default Olai face included)
- `playwright/` — chromium browsers for e2e (`PLAYWRIGHT_BROWSERS_PATH`)
