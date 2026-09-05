Packages this tree overlays onto ekapkgs because the pin does not yet
ship them. Each is a candidate to drop when the pin grows the attribute.

Hosted typefaces live in the pin (ekapkgs#5), not here.

- `mk-shell.nix` — `pkgs.mkShell`
- `nixpkgs-fmt.nix` — formatter this tree already uses (ekapkgs ships nixfmt)
- `playwright/` — chromium browsers for e2e (`PLAYWRIGHT_BROWSERS_PATH`)

`nix/ekapkgs.nix` also attaches a python overlay that ignores
`charset-normalizer.override { withMypyc = … }` (corepkgs fetch-cargo-vendor
vs python-pkgs). Drop it when that eval works vanilla.
