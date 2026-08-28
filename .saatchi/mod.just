# env from saatchi: PORT (bind), HOME (already .saatchi/home), DATA (serve this)
#
# The spec's recipe is `bun run olai web --port "$PORT" --dir "$DATA"`. olai's
# CLI is `web <directory> --port` (positional directory, no `--dir`), there is
# no package.json `olai` script, and the working-tree server will not boot
# without OLAI_DIST_DIR pointing at `just build-client`'s output. `bun` is a
# flake input, so outside a devShell the exec has to re-enter one — the same
# `nix_shell` the root justfile uses for every bun leg.
root := justfile_directory() + "/.."
nix_shell := if env('IN_NIX_SHELL', '') != '' { '' } else { 'nix develop ' + root + ' --accept-flake-config -c' }

serve:
    #!/usr/bin/env bash
    set -euo pipefail
    cd {{root}}
    just build-client
    export OLAI_DIST_DIR="$PWD/packages/web/dist"
    # Empty, not unset: a driver does not inherit the laptop's agent roster
    # (`packages/tests/support/serve.sh`). Seed `.saatchi/home` for a section
    # that talks to one.
    export OLAI_ACP_AGENT=
    export OLAI_AGENT_PATH=
    exec {{ nix_shell }} bun packages/server/src/main.ts web "$DATA" --port "$PORT"
