# env from saatchi: PORT (bind), HOME (already .saatchi/home), DATA (serve this)
#
# The spec's recipe is `bun run olai web --port "$PORT" --dir "$DATA"`. olai's
# CLI is `web <directory> --port` (positional directory, no `--dir`), there is
# no package.json `olai` script, and the working-tree server will not boot
# without OLAI_DIST_DIR. `bun` is a flake input, so outside a devShell the
# exec has to re-enter one — the same `nix_shell` the root justfile uses.
root := justfile_directory() + "/.."
nix_shell := if env('IN_NIX_SHELL', '') != '' { '' } else { 'nix develop ' + root + ' --accept-flake-config -c' }

serve:
    #!/usr/bin/env bash
    set -euo pipefail
    cd {{root}}
    # saatchi points HOME at .saatchi/home (olai's state). Caches must not
    # follow it: `git clean -fx .saatchi/` would then cold-start nix+bun
    # inside the 30s readiness deadline.
    user_home=$(getent passwd "$(id -un)" | cut -d: -f6)
    : "${user_home:?could not resolve the real home directory}"
    export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$user_home/.cache}"
    export BUN_INSTALL_CACHE_DIR="${BUN_INSTALL_CACHE_DIR:-$user_home/.bun/install/cache}"
    # saatchi serves DATA in place. When that's the tracked fixtures, a
    # writing section would mutate them. Copy into data/ (throwaway) and
    # serve the copy.
    fixtures="{{root}}/.saatchi/fixtures"
    scratch="{{root}}/.saatchi/data"
    if [[ "$(realpath "$DATA")" == "$(realpath "$fixtures")" ]]; then
        rm -rf "$scratch"
        mkdir -p "$scratch"
        cp -a "$DATA"/. "$scratch"/
        DATA="$scratch"
    fi
    {{ nix_shell }} just build-client
    # The one place the server is told to look (justfile:25).
    export OLAI_DIST_DIR="$PWD/packages/web/dist"
    # The one law for every knob that reaches the served server: THE CALL
    # ANSWERS, the recipe passes through, EMPTY IS OFF — the recipe itself
    # decides nothing. A pi row needs both halves handed in: OLAI_ACP_PI for
    # the adapter, the `pi` on OLAI_AGENT_PATH for the probe.
    export OLAI_ACP_AGENT="${AGENT:-}"
    export OLAI_ACP_PI="${PI_AGENT:-}"
    export OLAI_AGENT_PATH="${OLAI_AGENT_PATH:-}"
    exec {{ nix_shell }} bun packages/server/src/main.ts web "$DATA" --port "$PORT"
