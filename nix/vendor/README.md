Packages this tree overlays onto ekapkgs because the pin does not yet
ship them. Each is a candidate to drop when the pin grows the attribute.

- `fonts/` — hosted typefaces the default face serves (ekapkgs#5 may not merge)
- `playwright/` — chromium browsers for e2e (`PLAYWRIGHT_BROWSERS_PATH`)

`ripgrep`, `npins` and `nixpkgs-fmt` come from the ekapkgs pin.
`nixpkgs-fmt.nix` remains as the expression the pin carries; the overlay
no longer calls it.
