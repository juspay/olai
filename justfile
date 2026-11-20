nix_shell := if env('IN_NIX_SHELL', '') != '' { '' } else { 'nix develop ' + justfile_directory() + ' --accept-flake-config -c' }

nix_files := "$(git ls-files '*.nix')"

bun_roots := ". website"

dist := justfile_directory() + "/packages/web/dist"

nix_shell_e2e := if env('PLAYWRIGHT_BROWSERS_PATH', '') != '' { '' } else { 'nix develop ' + justfile_directory() + '#e2e --accept-flake-config -c' }

[doc("List available recipes")]
default:
    @just --list

[linux]
[macos]
[parallel]
[metadata("ci")]
[doc("Run all checks in the CI pipeline")]
check: typecheck test e2e kolu-deps plugin-deps plugin-checks cordis-deps fmt-check nix bun-nix-fresh hm-module runtime plugin-fold website

[doc("Install dependencies and generate pinned sources and assets")]
install:
    {{ nix_shell }} sh -c 'bun install --frozen-lockfile \
      && sh $OLAI_PLUGIN_INSTALL \
      && sh $OLAI_KOLU_HYDRATE_SCRIPT $OLAI_KOLU_HYDRATE \
      && sh $OLAI_KOLU_HYDRATE_SCRIPT $OLAI_CORDIS_HYDRATE \
      && bun packages/bundle/generate.ts'

[metadata("odu:shard=6")]
[doc("Type-check all workspace packages")]
typecheck: install
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ -z "${ODU_SHARD_INDEX+x}" && -z "${ODU_SHARD_TOTAL+x}" ]]; then
      exec {{ nix_shell }} bun run typecheck
    fi
    if [[ ! "${ODU_SHARD_INDEX:-}" =~ ^(0|[1-9][0-9]*)$ || ! "${ODU_SHARD_TOTAL:-}" =~ ^[1-9][0-9]*$ ]] \
      || ((ODU_SHARD_INDEX >= ODU_SHARD_TOTAL)); then
      echo "invalid ODU_SHARD_INDEX / ODU_SHARD_TOTAL" >&2
      exit 2
    fi
    members=$({{ nix_shell }} sh scripts/workspace-members.sh .)
    filters=()
    position=0
    while IFS= read -r member; do
      if ((position % ODU_SHARD_TOTAL == ODU_SHARD_INDEX)); then
        filters+=(--filter "./$member")
      fi
      ((position += 1))
    done <<< "$(printf '%s\n' "$members" | LC_ALL=C sort -u)"
    if ((${#filters[@]})); then
      exec {{ nix_shell }} bun run "${filters[@]}" typecheck
    fi

[metadata("odu:shard=6")]
[doc("Run unit tests, including browser reactivity tests")]
test: install
    {{ nix_shell }} bash scripts/test-shard.sh

[doc("Check dependency versions against the kolu pin")]
kolu-deps:
    {{ nix_shell }} sh -c 'sh scripts/check-hydrated-deps.sh kolu "$OLAI_KOLU_EXTERNALS"'

[doc("Check dependency versions against every plugin's pin")]
plugin-deps:
    {{ nix_shell }} sh -c 'sh scripts/check-hydrated-deps.sh plugins "$OLAI_PLUGIN_EXTERNALS"'

[doc("Verify every plugin's sandboxed surface check")]
plugin-checks:
    nix build .#checks.$(nix eval --impure --raw --expr builtins.currentSystem).plugins --no-link --accept-flake-config

[doc("Check dependency versions against the Cordis pin")]
cordis-deps:
    {{ nix_shell }} sh -c 'sh scripts/check-hydrated-deps.sh cordis "$OLAI_CORDIS_EXTERNALS"'

[doc("Build the browser bundle into packages/web/dist")]
build-client: install
    {{ nix_shell }} bun packages/web/src/build.ts {{ dist }}

[doc("Serve a directory with client and server file watching")]
serve dir="website/docs" *args: build-client
    #!/usr/bin/env bash
    set -euo pipefail
    . "$(sh scripts/nix-out.sh .#plugin-env)"
    trap 'kill 0' EXIT INT TERM
    {{ nix_shell }} bun --watch packages/web/src/build.ts {{ dist }} &
    OLAI_DIST_DIR={{ dist }} \
      {{ nix_shell }} bun --watch packages/server/src/main.ts web {{ dir }} {{ args }}

[doc("Serve a directory with server file watching")]
run dir="website/docs" *args: build-client
    #!/usr/bin/env bash
    set -euo pipefail
    . "$(sh scripts/nix-out.sh .#plugin-env)"
    OLAI_DIST_DIR={{ dist }} \
      {{ nix_shell }} bun --watch packages/server/src/main.ts web {{ dir }} {{ args }}

[doc("Build and verify the Nix-packaged binary")]
nix:
    #!/usr/bin/env bash
    set -euo pipefail
    out=$(sh scripts/nix-out.sh .#olai)
    echo >&2 "nix run .#olai -- --help"
    nix run .#olai --accept-flake-config -- --help > /dev/null
    table=$(nix eval --raw .#olai.passthru.knobsTable --accept-flake-config)
    bash scripts/check-wrapper-knobs.sh "$out/bin/olai" "$table"

[doc("Check the plugin registry fold (contracts and collisions)")]
plugin-fold:
    nix build .#checks.$(nix eval --impure --raw --expr builtins.currentSystem).plugin-fold --no-link --accept-flake-config
[doc("Check the Home Manager module")]
hm-module:
    nix build .#checks.$(nix eval --impure --raw --expr builtins.currentSystem).hm-module --no-link --accept-flake-config

[doc("Check the launch command without a supervisor")]
runtime:
    nix build .#checks.$(nix eval --impure --raw --expr builtins.currentSystem).runtime --no-link --accept-flake-config

[doc("Build the website and check its links")]
website:
    nix build .#website --no-link --print-out-paths --accept-flake-config

[doc("Preview the website with live reload")]
website-dev:
    cd website && {{ nix_shell }} sh -c 'bun install --frozen-lockfile && bun run dev'

[doc("Serve an interactive graph of plugin rows, their needs, offers and locations")]
cordis-graph port="4949": install
    {{ nix_shell }} bun scripts/cordis-graph.ts {{ port }}

[doc("Run performance benchmarks")]
bench: install
    {{ nix_shell }} bun packages/format/src/patch.bench.ts
    {{ nix_shell }} bun packages/format/src/filter.bench.ts
    {{ nix_shell }} bun packages/format/src/vocabulary.bench.ts
    {{ nix_shell }} bun packages/format/src/dates.bench.ts
    {{ nix_shell }} bun packages/format/src/scope.bench.ts
    {{ nix_shell }} bun packages/index/src/index.bench.ts
    {{ nix_shell }} bun packages/ops/src/documents.bench.ts
    {{ nix_shell }} bun packages/ops/src/pending.bench.ts
    {{ nix_shell }} bun packages/server/src/published.bench.ts
    {{ nix_shell }} bun packages/ops/src/standing.bench.ts
    {{ nix_shell }} bun packages/format/src/validate.bench.ts
    {{ nix_shell }} bun packages/format/src/pointing.bench.ts
    {{ nix_shell }} bun packages/ops/src/walks.bench.ts
    {{ nix_shell }} bun packages/format/src/conventions.bench.ts

[doc("Re-record the planner's golden answers after a deliberate change to what an op says")]
record-plans:
    {{ nix_shell }} env OLAI_RECORD_PLANS=1 bun test packages/ops/src/plans.golden.test.ts

[doc("Create a worktree-local binary wrapper for e2e tests")]
dev-bin:
    #!/usr/bin/env bash
    set -euo pipefail
    dir="{{ justfile_directory() }}/.olai-dev"
    mkdir -p "$dir"
    plugin_env="$(sh scripts/nix-out.sh .#plugin-env)"
    printf '#!/usr/bin/env bash\n' > "$dir/bin"
    printf 'export OLAI_DIST_DIR="${OLAI_DIST_DIR-%s}"\n' "{{ dist }}" >> "$dir/bin"
    printf '. %s\n' "\"$plugin_env\"" >> "$dir/bin"
    printf 'exec bun %s/packages/server/src/main.ts "$@"\n' \
      "{{ justfile_directory() }}" >> "$dir/bin"
    chmod +x "$dir/bin"
    echo "$dir/bin"

[metadata("odu:shard=9")]
[doc("Run browser tests against the Nix-packaged binary")]
e2e: install
    #!/usr/bin/env bash
    set -uo pipefail
    bin="$(sh scripts/nix-out.sh .#olai)/bin/olai"
    export OLAI_E2E_ATTEMPT="${OLAI_E2E_ATTEMPT:-$(git rev-parse --short HEAD 2>/dev/null || echo nosha)-$(date -u +%Y%m%dT%H%M%SZ)-$$${ODU_SHARD_INDEX:+-shard$ODU_SHARD_INDEX}}"
    export OLAI_E2E_EVIDENCE="${OLAI_E2E_EVIDENCE:-${XDG_STATE_HOME:-$HOME/.local/state}/olai/e2e-evidence}"
    cd packages/tests
    if [[ -n "${ODU_SHARD_TOTAL:-}" ]]; then
      export CUCUMBER_SHARD="$((ODU_SHARD_INDEX + 1))/$ODU_SHARD_TOTAL"
    fi
    OLAI_BIN="$bin" {{ nix_shell_e2e }} bun run test
    status=$?
    kept="$OLAI_E2E_EVIDENCE/$OLAI_E2E_ATTEMPT"
    if [[ -d "$kept" ]]; then
      echo "olai-e2e-evidence: kept in $kept"
      for note in "$kept"/*.txt; do [[ -e "$note" ]] && cat "$note" || true; done
      ls -1 "$kept" | sed 's/^/olai-e2e-evidence: file /' || true
    fi
    exit $status

[group("fast-remote")]
[doc("Run browser tests on the remote Linux fleet")]
e2e-fast-remote: (_fast-remote "e2e" (env("ODU_E2E_REMOTE_TIMEOUT", "10m")))

[group("fast-remote")]
[doc("Run unit tests on the remote Linux fleet")]
test-fast-remote: (_fast-remote "test" (env("ODU_TEST_REMOTE_TIMEOUT", "10m")))

[group("fast-remote")]
[doc("Type-check workspace packages on the remote Linux fleet")]
typecheck-fast-remote: (_fast-remote "typecheck" (env("ODU_TYPECHECK_REMOTE_TIMEOUT", "10m")))

[private]
_fast-remote leaf $watch_timeout:
    #!/usr/bin/env bash
    set -euo pipefail
    exec {{ nix_shell }} timeout --foreground --signal=INT --kill-after=30s \
      "$watch_timeout" \
      nix run .#odu --accept-flake-config -- ci run {{ leaf }} --platform x86_64-linux --no-strict

[doc("Run full CI on the remote Linux fleet")]
ci:
    #!/usr/bin/env bash
    set -euo pipefail
    exec {{ nix_shell }} timeout --foreground --signal=INT --kill-after=30s \
      "${ODU_CI_TIMEOUT:-15m}" \
      nix run .#odu --accept-flake-config -- ci run --platform x86_64-linux

[doc("Format repository Nix files")]
fmt:
    {{ nix_shell }} nixpkgs-fmt {{ nix_files }}

[doc("Check Nix formatting without modifying files")]
fmt-check:
    {{ nix_shell }} nixpkgs-fmt --check {{ nix_files }}

[private]
_gen-bun-nix dir out:
    {{ nix_shell }} sh -c 'nix run .#bun2nix --accept-flake-config -- -l "{{ dir }}/bun.lock" -o "{{ out }}" && nixpkgs-fmt "{{ out }}"'

[doc("Regenerate bun.nix from bun.lock")]
regenerate-bun-nix:
    for dir in {{ bun_roots }}; do just _gen-bun-nix "$dir" "$dir/bun.nix"; done

[doc("Check that every bun.nix matches its bun.lock")]
bun-nix-fresh:
    #!/usr/bin/env bash
    set -euo pipefail
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    for dir in {{ bun_roots }}; do
      just _gen-bun-nix "$dir" "$tmp/bun.nix"
      diff -u "$dir/bun.nix" "$tmp/bun.nix" || {
        echo
        echo "$dir/bun.nix is stale relative to $dir/bun.lock."
        echo "Run: just regenerate-bun-nix && git add $dir/bun.nix"
        exit 1
      }
    done

[doc("Update npins dependencies and format the generated Nix file")]
update-pins:
    {{ nix_shell }} sh -c 'npins update && nixpkgs-fmt npins/default.nix'
