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
    fixtures="{{root}}/.saatchi/fixtures"
    scratch="{{root}}/.saatchi/data"
    if [[ "$(realpath "$DATA")" == "$(realpath "$fixtures")" ]]; then
        rm -rf "$scratch"
        mkdir -p "$scratch"
        cp -a "$DATA"/. "$scratch"/
        DATA="$scratch"
    fi
    {{ nix_shell }} just build-client
    export OLAI_DIST_DIR="$PWD/packages/web/dist"
    if [[ -z "${AGENT:-}" && -f "$HOME/olai-acp-agent" ]]; then
        AGENT="$(cat "$HOME/olai-acp-agent")"
    fi
    export KOLU_ACP_AGENT="${AGENT:-}"
    if [[ -z "${ODU_WEB_ORIGIN:-}" && -f "$HOME/odu-web-origin" ]]; then
        export ODU_WEB_ORIGIN="$(cat "$HOME/odu-web-origin")"
    fi
    export OLAI_ACP_PI="${PI_AGENT:-}"
    export OLAI_AGENT_PATH="${OLAI_AGENT_PATH:-}"
    export OLAI_HIMALAYA="$(sh scripts/nix-out.sh .#himalaya-bin)/bin/himalaya"
    [[ -n "${EXTRA_PATH:-}" ]] && export PATH="$EXTRA_PATH:$PATH"
    exec {{ nix_shell }} bun packages/server/src/main.ts web "$DATA" --port "$PORT"
