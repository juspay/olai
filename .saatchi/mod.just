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
    # AGENT= is the passthrough (`packages/tests/support/serve.sh`'s
    # `OLAI_ACP_AGENT="${AGENT:-}"`). Empty is off. Seeding HOME cannot
    # produce an agent — OLAI_AGENT_PATH is a binary search path, and
    # empty is "look nowhere".
    if [[ "${PI:-}" == "yes" ]]; then
        # THE PI LANE: both rows real — the pinned claude adapter for the
        # first, the pinned pi-acp for the second, and `pi` found on the
        # DEFAULT search path (the invoking shell's PATH, which is what makes
        # the lane useful: a box that has pi shows the row, and this one
        # decides nothing for it).
        export OLAI_ACP_AGENT="$(sh scripts/acp-agent.sh)"
        export OLAI_ACP_PI="$(sh scripts/acp-pi.sh)"
    else
        export OLAI_ACP_AGENT="${AGENT:-}"
        export OLAI_AGENT_PATH=
    fi
    exec {{ nix_shell }} bun packages/server/src/main.ts web "$DATA" --port "$PORT"
