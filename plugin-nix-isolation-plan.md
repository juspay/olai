# Plan: every plugin's Nix half lives in its own directory

One draft PR on this branch (`plugin-nix-isolation`). The implementor opens it as a draft, keeps it green on `just ci`, and never merges it or marks it ready. The human approves this plan first, then the PR.

Not committed. This file is the human's review copy, in the shape `mockups/tabbed-ui-plan.md` had for #604.

Scope, as the human ruled on 2026-09-15: the Nix, build and dev-loop isolation (sections 3 to 8), **and** the three non-Nix spreads found on the way (section 13): the test-shard weights, the geometry harness, and the e2e engine fakes. Section 14 records the decisions taken.

Sections: [what is true today](#1-what-is-true-today) · [the rule](#2-the-rule-and-its-cordis-reading) · [the contract](#3-the-contract-a-plugins-defaultnix) · [the registry fold](#4-the-registry-fold-packagesbundledefaultnix) · [the mechanism](#5-the-mechanism-said-once-packagesplugin-kitnix) · [per plugin](#6-what-moves-per-plugin) · [the root after](#7-the-root-after) · [dev loop](#8-the-dev-loop-and-the-justfile) · [enforcement](#9-enforcement-tests-and-checks) · [docs](#10-docs-to-update-in-the-same-pr) · [commits](#11-commit-sequence) · [done](#12-definition-of-done) · [the three non-Nix spreads](#13-the-three-non-nix-spreads-in-scope) · [decisions](#14-decisions-taken)

---

## 1. What is true today

Five of the forty-one plugins have a Nix half: `kolu`, `odu`, `claude`, `pi`, `codex`. The other thirty-six own nothing Nix builds, and find their tools on the search path or need none. Every one of the five spreads into the rest of the repository. Only Codex's derivation is inside its directory, and even Codex's knob and wrapper line are not.

### 1.1 Inventory, per plugin

| Plugin | Inside its directory | Outside its directory |
| --- | --- | --- |
| **odu** | `default.nix` (the mark only, `packages/plugins/odu/default.nix:1`) | `nix/odu.nix` (the three hydrated `@odu/*` sources, their externals, the pinned `odu` binary). `default.nix:9,32,114,118,169,205-206` (import, mark install into `src/browser/`, `odu-bin`, the `OLAI_ODU_BIN` `--set-default` and the PATH splice `--run`). `shell.nix:43-44,104`. `flake.nix:66-67` (`odu-mark`, `odu-bin`, `odu`). `justfile:89,93,225-226,249-250,407-435,757-760` (hydrate line, mark line, `odu-deps`, `odu-surface`, the `nix` recipe's odu assertions, `dev-bin`). `scripts/olai-path.sh`, `scripts/check-odu-surface.ts` (imports `packages/plugins/odu/src/probe.ts`). `.gitignore` (`mark.generated.ts`). |
| **kolu** | `default.nix` (the mark only) | `nix/kolu.nix:81-88,94-97`: three of its six seeds (`@kolu/detect`, `@kolu/solid-dockrow`, `terminal-themes`) are imported by this plugin alone, and the `osfacts-client` graft is pulled only by `@kolu/solid-dockrow`'s closure (verified against the pinned `consumer-closure.json`: dockrow's closure is 29 members and is the only one reaching `osfacts-client`). `default.nix:31,117`. `shell.nix:98`. `flake.nix:66` (`kolu-mark`). `justfile:92`. `.gitignore`. |
| **claude** | `acp/patches/*.patch`, `acp/patches/README.md`, `acp/session-list-info/` (the regen rig) | `acp/package.json` and `acp/package-lock.json` at the repo root (the npm shim pinning `@agentclientprotocol/claude-agent-acp` 0.73.0). `nix/acp-agent.nix` (the whole derivation: `patchesFor` reaching into `../packages/plugins/<name>/acp/patches` at line 131, the claude `engines` row at 149-167 with its five env lines, the patchelf of the bun-compiled `claude`). `default.nix:159,202`. `flake.nix:66` (`acp-agent`). `scripts/acp-agent.sh`. `justfile:86-87` (`npm ci` in `acp/`), `294,332` (export), `366-378` (assertion). `regenerate.sh:38` reads `$repo/acp/package-lock.json`. |
| **pi** | `acp/patches/pi-mcp-servers.patch`, `acp/mcp-bridge/` (extension, naming, wire, tests, regen) | The same root `acp/` shim (`pi-acp` 0.0.33, plus `@modelcontextprotocol/sdk` and `typebox` for the bridge). `nix/acp-agent.nix:107-108,168-185,207-218` (the bridge path, the pi row, the esbuild bundle step). `default.nix:204`. `scripts/acp-pi.sh`. `justfile:301,334,392-406`. `roundtrip.test.js:33` reaches `../../../../../acp/node_modules/`. |
| **codex** | `acp/default.nix` (the whole derivation), `acp/permission-mode.test.ts.in`, `acp/README.md` | `default.nix:163,203` (`callPackage`, `OLAI_ACP_CODEX`). `flake.nix:66` (`codex-agent`). `scripts/acp-codex.sh`. `justfile:297,333,379-391`. |

### 1.2 Spreads that are not per-plugin

- **The wrapper spells every knob.** `default.nix:201-206` names `OLAI_ACP_AGENT`, `OLAI_ACP_CODEX`, `OLAI_ACP_PI`, `OLAI_ODU_BIN`, decides which is a file and which a directory, and writes the `OLAI_WRAPPER_DEFAULTS` list the settings panel reads (`packages/plugin-api/src/configuration.ts:156`). Each plugin declares the same key again in its `server.ts` `environment` list (`packages/plugins/claude/src/server.ts:87`, `pi/src/server.ts:79`, `codex/src/server.ts:32`, `odu/src/server.ts:166`). Two spellings, nothing holding them equal.
- **The `nix` recipe restates the wrapper** (`justfile:356-435`): four hand-written assertion blocks, one per knob.
- **`dev-bin` hand-copies the wrapper's PATH line** (`justfile:757-760`) and names odu.
- **Four root scripts exist to answer one plugin each**: `scripts/acp-agent.sh`, `acp-codex.sh`, `acp-pi.sh`, `olai-path.sh`.
- **`.gitignore` names two plugin paths** for their generated marks.
- **Docs name the outside files by path**: `docs/running.md:55`, `docs/architecture/overview.md:194,253`, `docs/architecture/plugin-system.md:927-931`, `acp/README.md`, the two `patches/README.md`, `packages/plugins/codex/acp/README.md`, `packages/plugin-kit/README.md`, `packages/plugins/kolu/README.md:89`, `packages/tests/README.md:171`.

### 1.3 What already holds and stays

- `packages/plugin-kit/default.nix` is the mark mechanism, said once, with no plugin named. It stays the mechanism and grows.
- `packages/plugins/codex/acp/default.nix` is the shape every shipped adapter should have: one derivation, inside the plugin, with its own lock and clock.
- `nix/kolu.nix` for the framework seeds (`@kolu/surface-app`, `@kolu/surface-cli`, `@kolu/surface-mcp`) and `nix/cordis.nix` are pins of olai's own floor, not of a plugin. They stay at the root.
- `bun.nix` enumerates every workspace member (`bun.nix:7634-7674`). It is generated from `bun.lock` and checked fresh by `bun-nix-fresh`. A lockfile naming members is not a spread.
- `packages/bundle/olai.yml` is the one place a plugin is named by hand, and `fence.test.ts:638-665` holds `packages/plugins/` equal to that roster in both directions. The Nix side below leans on exactly that claim.

---

## 2. The rule, and its Cordis reading

The plugin system's rule (`docs/architecture/plugin-system.md` §1): a general package may know a plugin's **name** and nothing else. The Nix side gets the same rule.

> A file outside `packages/plugins/<name>/` may know that the container holds a directory, and the shape of the contract every plugin's `default.nix` answers. It may not know a plugin's word, a path inside it, a knob it reads, a binary it ships, a pin it hydrates from, or a file it generates.

The Cordis reading, term by term, since the human holds every change to it (CLAUDE.md):

| Cordis term | Nix-side meaning in this PR |
| --- | --- |
| **Coeffect (need)** | A plugin's `default.nix` takes what it needs as arguments: `pkgs`, `pins`, `kit`, and an optional `b2n`. It reaches for nothing by relative path outside its directory. Today `packages/plugins/kolu/default.nix:9` reaches `../../../npins` and `:11` reaches `../../plugin-kit`. |
| **Effect (provide)** | What a plugin provides is a fixed-shape attrset, section 3. Nothing else of it is visible. |
| **Owner** | The plugin directory owns its derivations, its lock, its patches, its generated files and its knobs. The registry (`packages/bundle`) owns the composition. The root owns the wrapper and the dev shell, and both are computed from the composition. |
| **Atomic ownership claim** | Two plugins claiming one flake output name, one knob, one hydrate destination or one generated path is refused at eval, naming both. |
| **Optional availability** | A plugin with no `default.nix` has no Nix half. That is the ordinary case, thirty-six of forty-one, and it is not an error. `b2n = null` keeps a binary lazy in the dev shell, as `nix/odu.nix:57-60` does today. |
| **Loud absence** | An unknown attribute in a contract, a generated path without the `.generated.` infix, a knob nix supplies that the manifest does not declare, or the reverse, fails eval by name. |
| **No hidden dependency** | The importer declares the seed. `@kolu/solid-dockrow` and the `osfacts` graft are declared by the plugin that imports them, not by `nix/kolu.nix`. |
| **Cleanup and withdrawal** | Not a runtime concern for evaluation. Runtime ownership is untouched: plugins still read knobs through the `Env` service and declare them in `environment`, and the wrapper still bakes defaults with `--set-default` so an empty value stays the off switch. |

Runtime behaviour is unchanged by design. Every store path a plugin resolves today it resolves after. The change is where the facts are written and who is allowed to read them.

---

## 3. The contract: a plugin's `default.nix`

`packages/plugins/<name>/default.nix`, when present, is a function:

```nix
{ pkgs, pins, kit, b2n ? null }: { ... }
```

| Argument | What it is |
| --- | --- |
| `pkgs` | The pinned nixpkgs, one per system. |
| `pins` | `import ./npins` evaluated by the root, handed in. A plugin names its pin by attribute (`pins.odu`) and never reaches `../../../npins`. |
| `kit` | `import ./packages/plugin-kit/nix`, the mechanisms of section 5. |
| `b2n` | bun2nix's package, or `null` in the dev shell. A plugin whose binary needs it keeps that attribute lazy. |

It returns an attrset. Every key is optional. Any other key is refused.

| Key | Type | Meaning | Consumer |
| --- | --- | --- | --- |
| `hydrate` | list of `{ src; dest; }` | Sources copied into `node_modules/<dest>` after `bun install`, with kolu's copier. | `base` build and `just install`. |
| `externals` | attrset name → version | The npm externals those sources need at the root, for `scripts/check-hydrated-deps.sh`. | `just plugin-deps`. |
| `koluSeeds` | list of strings | kolu package names this plugin's own source imports. Unioned into `nix/kolu.nix`'s seeds. | `nix/kolu.nix`. |
| `koluPins` | attrset name → `{ src; revision; }` | Grafts kolu's closure needs that this plugin's seeds pull in (`osfacts-client`). | `nix/kolu.nix`'s `pinnedSources`. |
| `generated` | attrset plugin-relative path → store file | Files written into the plugin's own tree. The path must contain `.generated.`. | `base` build and `just install`. |
| `npmTrees` | list of plugin-relative dirs | Directories `just install` runs `npm ci` in, for tests that resolve a pin's node_modules. Dev shell only. | `just install`. |
| `knobs` | attrset var → `{ kind = "file"; path; }` or `{ kind = "dir"; path; holds = "<exe>"; }` | The executables the packaged wrapper bakes as `--set-default`, and how a `dir` kind is spliced onto PATH. Keys must equal the manifest's `olai.knobs` keys. | The `olai` wrapper, `.#plugin-env`, `just nix`. |
| `packages` | attrset name → derivation | Flake outputs this plugin contributes. | `flake.nix` `packages`. |
| `checks` | function `{ tree }` → attrset name → derivation | Checks that need the built tree (the odu surface probe). Exposed as `checks.<system>.plugin-<name>-<check>`. | `just plugin-checks`. |

Two rules the contract carries with it:

- **One spelling for a knob.** The plugin's `package.json` gains `"olai": { "knobs": { "OLAI_ACP_AGENT": "file" } }` beside the existing `contracts`. The nix side reads it with `lib.importJSON` and refuses a mismatch; a bun test holds `server.ts`'s `environment` resource keys equal to it (section 9). One fact, three readers, nothing copied.
- **A plugin's Nix half may be several files.** The door is `default.nix`; a plugin may factor into `nix/*.nix` or keep `acp/default.nix` beside its patches, as Codex does. Nothing outside the directory imports anything but the door.

---

## 4. The registry fold: `packages/bundle/default.nix`

`@olai/bundle` is the registry: the one package that imports every plugin. Its Nix file is the same thing for evaluation.

```nix
{ pkgs, pins, b2n ? null, container ? ../plugins }: { ... }
```

What it does:

1. `builtins.readDir container`, keeps directories, and imports `<dir>/default.nix` where one exists. It names no plugin. The fence's ninth claim already proves this directory equals the roster.
2. Validates every contract with `kit.contract` (section 5): known keys, right types, `.generated.` infix, knob keys equal to the manifest's `olai.knobs`.
3. Folds, refusing collisions by name: `packages` (disjoint union, both plugins named on a clash), `knobs` (same), `hydrate` destinations (same), `generated` paths (same, and the path is prefixed with the plugin's directory).
4. Returns:

| Attribute | Content |
| --- | --- |
| `plugins` | attrset name → validated contract, for anything that needs to iterate. |
| `hydrateScript` | A `writeShellScript` that runs kolu's copier over every plugin's `hydrate` and installs every `generated` file with `install -m 644`. One script for the sandbox and the dev shell, so the two cannot drift. `postBunNodeModulesInstallPhase` runs it; `just install` runs it. |
| `devInstallScript` | `npm ci` in every `npmTrees` dir (announced on stderr, the flags `justfile:86-87` uses today), then `hydrateScript`. Dev shell only. |
| `externals` | attrset plugin → externals, for the `plugin-deps` leg. |
| `koluSeeds`, `koluPins` | The unions, handed to `nix/kolu.nix`. |
| `knobs` | The merged knob table. |
| `wrapperArgs` | The `makeWrapper` argument text for every knob, generated by `kit.knobShell`. |
| `devEnv` | A `writeText` shell snippet with the same defaults for the dev loop (section 8). |
| `packages` | The merged flake outputs. |
| `checks` | `{ tree }: { plugin-<name>-<check> = ...; }` plus an aggregate `plugins` link farm. |

Why the bundle and not the root: the TS layout is plugin-api and plugin-kit (interface and mechanism), bundle (registry), plugins, root (composition). The Nix layout should read the same way, so a reader who knows one knows the other.

---

## 5. The mechanism, said once: `packages/plugin-kit/nix/`

`packages/plugin-kit/default.nix` becomes `import ./nix`, returning `{ mark; npmAdapter; contract; knobShell; }`.

| File | Content | Replaces |
| --- | --- | --- |
| `nix/mark.nix` | The current `packages/plugin-kit/default.nix`, unchanged. | The same file, moved. |
| `nix/npm-adapter.nix` | A function building one ACP adapter from an npm shim: `{ name, version, shim, npmDepsHash, package, entry, bin, patches, env, postInstall ? "" }`. Carries `buildNpmPackage`, `dontNpmBuild`, `--ignore-scripts`, `dontStrip`, `dontPatchELF`, the sorted `patchesFor` over a `patches/` directory, `patch -p1 -F0`, and the `makeWrapper` over `nodejs`. Names no plugin. | `nix/acp-agent.nix:49-96,130-139,187-205`. |
| `nix/contract.nix` | The validator of section 3: the key list, types, the `.generated.` rule, the knob-versus-manifest equality. Every refusal names the plugin. | Nothing; new. |
| `nix/knob-shell.nix` | Given the knob table, emits (a) the `--set-default` and `--run` lines for `makeWrapper`, and (b) the equivalent `export VAR="${VAR-default}"` snippet for a shell. One function, two renderings, so the wrapper and the dev loop cannot say different things. The `dir` arm keeps the guard `default.nix:206` has today, verbatim, and the `OLAI_WRAPPER_DEFAULTS` loop over the declared keys. | `default.nix:201-206`, `justfile:757-760`, `scripts/olai-path.sh`, `scripts/acp-*.sh`. |

Codex's derivation is not rewritten onto `npm-adapter.nix`: it fetches a GitHub source and runs a vitest check, and its README argues its own shape. It is called by the codex `default.nix` as today, one directory down.

---

## 6. What moves, per plugin

### 6.1 odu

New `packages/plugins/odu/default.nix`:

```nix
{ pkgs, pins, kit, b2n ? null }:
let
  src = pins.odu;
  mark = kit.mark { inherit pkgs; svg = "${src}/logo.svg"; revision = src.revision; from = "juspay/odu logo.svg"; };
  bin = (import "${src}/default.nix" { pkgs = import "${src}/nix/nixpkgs.nix" { inherit (pkgs.stdenv.hostPlatform) system; }; inherit b2n; selfFlake = "${src}"; }).odu;
in {
  hydrate = map (p: { src = "${src}/packages/${p.dir}"; dest = p.name; }) [ ... three ... ];
  externals = ...;                      # nix/odu.nix:79-92, verbatim
  generated."src/browser/mark.generated.ts" = "${mark}/mark.generated.ts";
  knobs.OLAI_ODU_BIN = { kind = "dir"; path = "${bin}/bin"; holds = "odu"; };
  packages = { odu-bin = bin; odu = bin; odu-mark = mark; };
  checks = { tree }: { surface = pkgs.runCommand "odu-surface" { nativeBuildInputs = [ pkgs.bun ]; } ''cd ${tree} && bun packages/plugins/odu/src/surface.check.ts ${bin}/bin && touch $out''; };
}
```

- `nix/odu.nix` is deleted. Its header prose about #105 and the binary ruling moves into this file.
- `scripts/check-odu-surface.ts` moves to `packages/plugins/odu/src/surface.check.ts`, with its import of `./probe.ts` now relative.
- `odu` as a flake output stays, because `just ci` and the fast-remote recipes run `nix run .#odu`. The plugin declares it and says in a comment that the same pinned binary is also this repository's CI runner. The root does not name it.
- The `package.json` gains `"olai": { "knobs": { "OLAI_ODU_BIN": "dir" } }`.
- The probe spawns `odu mcp` over stdio (`probe.ts:113,382`), so the check should run in the sandbox. **Verify this early** (commit 5). If the sandbox refuses, the fallback is a dev-shell arm: the contract gains `devChecks` (a shell script the dev shell runs from the repo root) and `just plugin-checks` runs both arms. Say which arm shipped in the PR body.

### 6.2 kolu

New `packages/plugins/kolu/default.nix`:

```nix
{ pkgs, pins, kit, ... }:
let src = pins.kolu; in {
  koluSeeds = [ "@kolu/detect" "@kolu/solid-dockrow" "terminal-themes" ];
  koluPins."osfacts-client" = { src = "${pins.osfacts}/client-ts"; revision = pins.osfacts.revision; };
  generated."src/browser/mark.generated.ts" = "${kit.mark { ... "${src}/packages/client/favicon.svg" ... }}/mark.generated.ts";
  packages.kolu-mark = mark;
}
```

- `nix/kolu.nix` keeps the three framework seeds and takes `{ pkgs, extraSeeds ? [], pinnedSources ? {} }`. Its header's paragraph about `olai-plugin-kolu/appliance` importing `@kolu/padi-client` (`nix/kolu.nix:73-80`) moves to the plugin, where the seed is now declared.
- No knob, no binary. `@kolu/surface*` stays the framework's.

### 6.3 claude

- `acp/package.json` and `acp/package-lock.json` split. `packages/plugins/claude/acp/shim/package.json` pins `@agentclientprotocol/claude-agent-acp` 0.73.0 alone. Regenerate the lock with `npm install --package-lock-only --ignore-scripts` in that directory; the hash moves.
- New `packages/plugins/claude/default.nix` calls `kit.npmAdapter` with the shim, `patches = ./acp/patches`, the five env lines from `nix/acp-agent.nix:160-166`, and a `postInstall` carrying the patchelf of the bun-compiled `claude` (`nix/acp-agent.nix:220-224`). Returns `knobs.OLAI_ACP_AGENT = { kind = "file"; path = "${agent}/bin/claude-agent-acp"; }` and `packages.claude-agent = agent`.
- `acp/session-list-info/regenerate.sh:38` reads `$here/../shim/package-lock.json`.
- `package.json` gains `"olai": { "knobs": { "OLAI_ACP_AGENT": "file" } }`.
- `acp/patches/README.md` and `acp/README.md` (now at `acp/shim/README.md`) say where the derivation is, and record the split and its cost: one FOD and one hash per engine, so a pi bump no longer moves claude's store path.

### 6.4 pi

- `packages/plugins/pi/acp/shim/package.json` pins `pi-acp` 0.0.33, `@modelcontextprotocol/sdk` 1.30.0, `typebox` 1.3.20. New lock, new hash.
- New `packages/plugins/pi/default.nix` calls `kit.npmAdapter` with `patches = ./acp/patches`, the one env line (`PI_ACP_MCP_EXTENSION`), and a `postInstall` that copies `./acp/mcp-bridge` into the shim tree and runs esbuild (`nix/acp-agent.nix:212-218`). Returns `knobs.OLAI_ACP_PI` and `packages.pi-agent`, and `npmTrees = [ "acp/shim" ]` because the bridge's tests resolve the SDK from that lock.
- `acp/mcp-bridge/roundtrip.test.js:33` resolves `../shim/node_modules/${spec}`; `extension.mjs:26-30` is unchanged because its relative imports mean something only inside the built tree.
- `acp/mcp-bridge/regenerate.sh` reads the lock beside it.
- `package.json` gains `"olai": { "knobs": { "OLAI_ACP_PI": "file" } }`.

`nix/acp-agent.nix` and the root `acp/` directory are deleted once both are green.

### 6.5 codex

- New `packages/plugins/codex/default.nix`: `{ pkgs, ... }: let agent = pkgs.callPackage ./acp { }; in { knobs.OLAI_ACP_CODEX = { kind = "file"; path = "${agent}/bin/codex-acp"; }; packages.codex-agent = agent; }`.
- `acp/default.nix` is untouched.
- `package.json` gains `"olai": { "knobs": { "OLAI_ACP_CODEX": "file" } }`.

### 6.6 Everything else

No `default.nix`. Nothing to write. The fold treats absence as the ordinary case.

---

## 7. The root after

| File | After |
| --- | --- |
| `default.nix` | Imports `bundle = import ./packages/bundle { inherit pkgs pins b2n; }`. `kolu` takes `extraSeeds = bundle.koluSeeds; pinnedSources = bundle.koluPins;`. `postBunNodeModulesInstallPhase` runs the kolu and cordis hydrates, `bundle.hydrateScript`, then `bun packages/bundle/generate.ts`. The `olai` wrapper takes `${bundle.wrapperArgs}` and gets `passthru.knobs = bundle.knobs`. Lines 31-32, 117-118, 159-169, 201-206 are gone. Returns `{ olai olai-client olai-fonts base; }` and `bundle`. |
| `shell.nix` | Exports `OLAI_PLUGIN_INSTALL = bundle.devInstallScript` and `OLAI_PLUGIN_EXTERNALS = builtins.toJSON bundle.externals`. Lines 9-10, 43-44, 98, 104 are gone. Kolu and cordis variables stay. |
| `flake.nix` | `packages = kolu.packages // bundle.packages // { inherit (olai) olai olai-client olai-fonts; default = olai.olai; bun2nix = b2n; plugin-env = bundle.devEnv; }`. A clash between a plugin output and a root output is refused. `checks = { hm-module; plugin-fold; } // bundle.checks { tree = olai.base; }`. |
| `nix/` | `nixpkgs.nix`, `bun.nix`, `kolu.nix`, `cordis.nix`, `home/`. `odu.nix` and `acp-agent.nix` are deleted. |
| `acp/` | Deleted. |
| `scripts/` | `acp-agent.sh`, `acp-codex.sh`, `acp-pi.sh`, `olai-path.sh`, `check-odu-surface.ts` are deleted. `nix-out.sh`, `check-hydrated-deps.sh`, `workspace-members.sh`, `prove-fence.sh` stay. |
| `.gitignore` | The two `mark.generated.ts` lines become one glob: `/packages/plugins/**/*.generated.ts`. The fold's `.generated.` rule is what makes the glob total. |

---

## 8. The dev loop and the justfile

| Recipe | After |
| --- | --- |
| `install` | `bun install --frozen-lockfile && sh $OLAI_PLUGIN_INSTALL && sh $OLAI_KOLU_HYDRATE_SCRIPT $OLAI_KOLU_HYDRATE && sh $OLAI_KOLU_HYDRATE_SCRIPT $OLAI_CORDIS_HYDRATE && bun packages/bundle/generate.ts`. Names no plugin. |
| `serve`, `run` | Replace the four exports and the two PATH lines with `. "$(sh scripts/nix-out.sh .#plugin-env)"`. The snippet keeps the `${VAR-default}` semantics, so unset means the pin and empty means off, exactly as today. |
| `dev-bin` | Writes `. <plugin-env path>` into the generated wrapper instead of its hand-copied odu lines. |
| `nix` | Reads `nix eval --json .#olai.passthru.knobs`. For each knob: assert the wrapper contains `VAR=${VAR-'…'}`, `test -x` for `file`, `test -d` and `test -x "$dir/$holds"` for `dir`, and that the PATH splice line is present when any `dir` knob exists. Assert the wrapper's `OLAI_WRAPPER_DEFAULTS` loop names exactly the declared keys. The four hand-written blocks are gone. |
| `odu-deps` → `plugin-deps` | Loops over `$OLAI_PLUGIN_EXTERNALS` and calls `check-hydrated-deps.sh <plugin> <json>` per entry, so a failure still names its pin. `kolu-deps` and `cordis-deps` stay. |
| `odu-surface` → `plugin-checks` | `nix build .#checks.<system>.plugins --no-link`. |
| `check` | `typecheck test e2e kolu-deps plugin-deps plugin-checks cordis-deps fmt-check nix bun-nix-fresh hm-module plugin-fold`. |
| `fmt`, `fmt-check` | Unchanged: `git ls-files '*.nix'` already sees the plugin directories. |
| `ci`, `_fast-remote` | Unchanged: `nix run .#odu` still resolves, now to the odu plugin's declared output. |

Cost note for the PR body: `.#plugin-env` builds every plugin's binary. `just serve` already builds all four on demand today, so the first run costs the same and later runs are cached.

---

## 9. Enforcement, tests and checks

Every claim in this plan becomes a test, in the repo's pattern (`plugin-system.md` §11).

| Where | Claim |
| --- | --- |
| `packages/bundle/src/fence.test.ts`, new describe *a plugin stays in its directory, outside the source graph too* | Corpus: every `*.nix` file, `justfile`, `shell.nix`, `default.nix`, `flake.nix`, `scripts/*`, and `packages/tests/support/**` and `packages/tests/agent/**` (section 13.3), all outside `packages/plugins/`, with `#` and `//` comments stripped. (1) None contains the path `packages/plugins/`. (2) None spells a plugin's word as an identifier, path segment, tag literal or variable, using claim 8's `namesAPlugin` reading. Allowances with a reason each, in the existing record style: `nix/kolu.nix` and the `kolu-deps` recipe (the framework pin shares the tenant's word), and the `@padi:` and `@odu-service:` tag handling in `hooks.ts` (section 13.4, the one harness spread left for a later ruling). Plus the vacuity checks the fence always carries: the corpus is non-empty and the reading can see a planted spelling. |
| `scripts/prove-fence.sh` | Three new mutations: plant `./packages/plugins/odu` in `default.nix`; plant `OLAI_ODU_BIN` in `justfile`; plant `"@pi"` in `packages/tests/support/hooks.ts`. All must go red. |
| `packages/bundle/src/knobs.test.ts` (new) | For every plugin manifest with `olai.knobs`: the keys equal the resource keys its `./server` module's `environment` declares. For every plugin without one: its `environment` declares no `OLAI_*` executable resource. Also: every `olai.knobs` value is `file` or `dir`. |
| `checks.plugin-fold` (new, `packages/bundle/nix/fold-check.nix`) | Evaluates the fold over fixture containers under `packages/bundle/nix/fixtures/`: a plugin with no `default.nix` (accepted), an unknown key, a generated path without `.generated.`, two plugins claiming one knob, one flake name, one hydrate dest, a knob the manifest lacks, a manifest knob nix lacks. Each refusal is asserted with `builtins.tryEval` and its message checked for both plugin names. |
| `just nix` | Generic assertions, section 8. |
| `checks.<system>.plugin-odu-surface` | The odu probe against the pinned binary, declared by the plugin. |
| `just plugin-deps` | The odu externals against the root manifest, as today. |
| `packages/plugins/kolu/src/browser/mark.test.ts`, `odu/…/mark.test.ts` | Unchanged claims; their doc comments name `../../default.nix`, still true. |
| `packages/plugins/pi/acp/mcp-bridge/*.test.js`, `claude/acp/session-list-info/facts.test.js` | Run under `bun test` as today; the pi tests now resolve against `acp/shim/node_modules`. |
| e2e | No user-visible change is intended, so the whole suite must pass against the packaged binary (`just e2e` uses `.#olai`). Audit these for the wrapper path specifically: `packages/plugins/chat/e2e/features/the_conversations_servers.feature` (runs the wrapper's real odu default, lines 26-29) and `packages/plugins/plugin-inspector/e2e/features/settings_panel.feature:186-189` (wrapper readings, but over a fake roster). Add one scenario that starts the packaged binary with `OLAI_ODU_BIN` left unset and asserts the settings panel reads that row as wrapper-provided, which exercises the generated `OLAI_WRAPPER_DEFAULTS` end to end. Do the same for one `file` knob if its probe runs without credentials; if not, say so in the feature file. Audit the existing off-switch scenarios (empty `OLAI_ACP_CODEX` omits the row, empty `OLAI_ODU_BIN` draws the missing row) and add any that are missing. Fix any bug found rather than working around it. |

---

## 10. Docs to update in the same PR

| File | Change |
| --- | --- |
| `docs/architecture/plugin-system.md` §10 | Step 6's last bullet (lines 927-931) rewritten: a shipped adapter is `packages/plugins/<name>/acp/` with its own shim and lock, and the plugin's `default.nix` declares it. New step 7: *If the plugin ships a binary, a pin or a generated file: `default.nix`*, with the contract table of section 3. §11 gains rows for the new fence describe, `knobs.test.ts`, `plugin-fold`, `plugin-checks`. §5's *Where it lives* row mentions the plugin's `generated` map. |
| `docs/architecture/overview.md:194,253` | Name the plugin's `default.nix` and `packages/plugin-kit/nix/` instead of `nix/acp-agent.nix` and the two `OLAI_*_MARK_DIR` variables. |
| `docs/running.md:55` | The on-demand builds are `.#plugin-env`; `npm ci` runs in each plugin's declared tree. |
| `packages/plugins/README.md` | A paragraph: what a plugin's `default.nix` is, and that the root reads the container, not a plugin. |
| `packages/plugin-kit/README.md` | The `nix/` directory and its four files. |
| `packages/bundle/README.md` | The Nix fold beside the TS registry. |
| `packages/plugins/kolu/README.md:89`, `odu/README.md:58` | Path of the mark declaration (now inside a larger `default.nix`). |
| `packages/plugins/claude/acp/patches/README.md`, `pi/acp/patches/README.md`, `pi/acp/mcp-bridge/README.md`, `codex/acp/README.md`, `codex/docs.md:9`, `claude/docs.md:9`, `pi/docs.md:11` | Replace every `nix/acp-agent.nix` and `acp/` reference; record the shim split. |
| `acp/README.md` | Deleted; its *why one lockfile* argument is replaced by the split's argument in each shim's README. |
| `packages/tests/README.md:171` | `dev-bin` sources the plugin env snippet. |
| `packages/tests/README.md:128-131,670-700` | The `agent/` tree entry and *The scripted agents* section: the core is generic and each engine's fake lives in its plugin (section 13.3). |
| `docs/architecture/e2e-coverage.md:237` | The omp fake's path. |
| `docs/architecture/plugin-system.md` §10 | New step 8: *If the plugin is an engine: `e2e/fake/`*, and a line under step 0 about `test-weights.json`. |
| `packages/tests/package.json` | The `//dependencies` and `//exports` prose: engine plugins leave the dependency list; `./harness/fake.ts` is the descriptor type's door. |
| `nix/kolu.nix`, `default.nix`, `shell.nix`, `flake.nix`, `scripts/test-shard.sh` headers | Rewritten to describe the fold and the per-package weights. |
| `CLAUDE.md`, `AGENTS.md`, `website/` | Not touched. |

---

## 11. Commit sequence

Each commit is green on `just ci` before the next. Use `just typecheck-fast-remote`, `test-fast-remote`, `e2e-fast-remote` between commits.

1. **Mechanism.** `packages/plugin-kit/nix/{mark,npm-adapter,contract,knob-shell}.nix`; `plugin-kit/default.nix` becomes the door. Kolu and odu marks call `kit.mark` through a temporary root shim so nothing else moves yet.
2. **Fold.** `packages/bundle/default.nix`, `fold-check.nix` and its fixtures; `checks.plugin-fold` wired; root still composes by hand.
3. **odu and kolu.** Their `default.nix` contracts; `nix/odu.nix` deleted; `nix/kolu.nix` takes `extraSeeds` and `pinnedSources`; `surface.check.ts` moved; root, shell, flake and `install` read the fold for hydrate, generated, packages and externals; `plugin-deps` and `plugin-checks` replace the two odu legs. Verify the sandboxed surface check here.
4. **Knobs.** `knob-shell.nix` drives the wrapper and `.#plugin-env`; `serve`, `run`, `dev-bin`, `nix` go generic; `olai.knobs` manifests and `knobs.test.ts`; `scripts/olai-path.sh` and `acp-codex.sh` deleted with codex's `default.nix` landing.
5. **claude and pi.** Shim split, two adapters, `nix/acp-agent.nix` and root `acp/` deleted, `acp-agent.sh` and `acp-pi.sh` deleted, test and regen paths fixed.
6. **Shard weights.** Section 13.1.
7. **Geometry harness.** Section 13.2.
8. **Engine fakes.** Section 13.3, in three commits: the generic core, the descriptor door and generated roster, then the harness fold with the five fakes moved.
9. **Fence.** The new describe, the prove-fence mutations, `.gitignore` glob.
10. **Docs.** Section 10.
11. **e2e.** The scenarios of section 9, and any bug they find.

Open the draft PR after commit 1 so CI runs on every push. Title: *Every plugin lives in its own directory: Nix, weights, harness and fakes*. The body lists the contract, the deleted files, the renamed flake outputs (`acp-agent` → `claude-agent` and `pi-agent`), the shim split and its cost, which arm the odu surface check shipped on, and the fake descriptor shape.

---

## 12. Definition of done

- `git grep -l 'packages/plugins' -- '*.nix' justfile shell.nix default.nix flake.nix scripts packages/tests/support packages/tests/agent` returns only files under `packages/plugins/` and `packages/bundle/default.nix`.
- `nix/odu.nix`, `nix/acp-agent.nix`, `acp/`, `scripts/acp-*.sh`, `scripts/olai-path.sh`, `scripts/check-odu-surface.ts`, `packages/tests/geometry/`, `packages/tests/agent/{kolu,omp,opencode,pi}/` and `packages/tests/agent/fake-acp-agent.ts` do not exist.
- `scripts/test-shard.sh` holds no file path. `fence.test.ts`'s `DEBT` record is empty and deleted.
- `packages/tests/package.json` depends on no engine plugin.
- `just check` is green, including the new legs, on `just ci`.
- `nix run .#olai -- --help`, `nix run .#odu -- --help`, `nix build .#claude-agent .#pi-agent .#codex-agent .#odu-bin .#kolu-mark .#odu-mark .#plugin-env` all build.
- `just serve` and `just run` start with the pinned adapters and odu, with no plugin named in the recipe.
- Every feature file is unchanged in its tags, and the whole e2e suite passes on the packaged binary.
- The PR is a draft. The implementor has not merged it, not marked it ready, and not rebased away the human's review.

---

## 13. The three non-Nix spreads, in scope

The human ruled all three in. Each gets the same treatment as the Nix half: the fact moves to the plugin, a general reader discovers it by shape, and a fence holds the root clean.

### 13.1 Test-shard weights

**Today.** `scripts/test-shard.sh:23-40` holds a `seconds` table of sixteen test files by repo path: eight plugin files (chat, git, navigation, outlines) and eight general ones (child, format, ops, server). The bash wrapper spawns an inline bun script that partitions every tracked test file over the shards by those weights.

**After.**

- A workspace member may carry `test-weights.json` at its root: `{ "src/scoped.test.ts": 12.7 }`, paths relative to the member. Sixteen entries move into eight files. General packages get one too, so the rule is *no member's path in a root script* and not *no plugin's*.
- The bash wrapper collects the members with `scripts/workspace-members.sh` (the one shell expansion of the `workspaces` field, per `package.json`'s own comment) and hands the list to the bun script as JSON on stdin. The bun script reads each member's `test-weights.json` if present and prefixes the member directory. `package.json`'s `//workspaces` comment gains no fifth reader because the reader is the existing script.
- A weight whose file is not tracked fails the recipe by name, so a moved or deleted test cannot keep a stale weight. The script's current tolerance ("absent/stale estimates cannot skip tests") holds for absent entries only; a present entry that names nothing is a typo.
- Partition, discovery and Bun conditions are unchanged.

**Enforcement.** The section 9 fence describe covers `scripts/*`, so a path planted back into `test-shard.sh` is red. A bun test under `packages/bundle/src/` (beside `knobs.test.ts`) asserts every `test-weights.json` in the tree names only tracked files under its own member and only positive numbers.

### 13.2 The geometry harness

**Today.** `packages/tests/geometry/{build.ts,harness.css,harness.tsx,shots.ts}` is a one-off driver for #405's evidence: it mounts kolu's own `DockRow` and `StatePip` and folds a real padi record. `fence.test.ts:1310-1334` records it as `DEBT`, the one breach of *an appliance's product tier stays inside its tenant*, and says where it belongs: behind `olai-plugin-kolu`. `build.ts:20-57` resolves `@babel/core`, `babel-preset-solid`, `@babel/preset-typescript` and `@tailwindcss/cli` out of `@olai/web`'s directory with `createRequire`, a relative climb into another package.

**After.**

- The four files move to `packages/plugins/kolu/e2e/geometry/`. `harness.tsx` importing `@kolu/solid-dockrow` is then a tenant naming its own tier, which needs no record.
- `shots.ts` imports `BROWSER_ARGS` from `@olai/tests/harness/browser.ts`, the declared door, not `../support/browser.ts`.
- `build.ts` resolves its four tools from the kolu plugin's own manifest: the four become `devDependencies` of `olai-plugin-kolu`, at the versions `@olai/web` pins, and `createRequire(import.meta.url)` replaces the climb. The plugin's `//devDependencies` prose says they serve one evidence driver and no test.
- The `DEBT` record and its `test("every DEBT key is a package…")` at `fence.test.ts:1407` are deleted. The tier claim then holds as a plain equality with nothing recorded.
- The two `bun packages/tests/geometry/…` usage lines in the file headers become `bun packages/plugins/kolu/e2e/geometry/…`.

If the human would rather delete the driver than carry four build tools in the tenant's manifest, say so in review: the `DEBT` deletion is the same either way, and nothing else depends on the files.

### 13.3 The e2e engine fakes

**Today.** `packages/tests/agent/` holds every engine's scripted fake: `fake-acp-agent.ts` (Claude-shaped, with a codex arm behind `OLAI_FAKE_CODEX`, importing `olai-plugin-claude/testlib` and `olai-plugin-codex/testlib` at lines 2-3), `opencode/`, `omp/`, `pi/` (each importing its engine's `./testlib`), and the tenant fake `kolu/kolu`. `hooks.ts` names each one: five directory constants (lines 281-356), four tag constants (367-395), five spawn options (737-767), and the environment fold that spells `OLAI_ACP_AGENT`, `OLAI_ACP_CODEX`, `OLAI_ACP_PI`, `OLAI_AGENT_PATH`, `OLAI_FAKE_CODEX` and four `OLAI_FAKE_*_STORED` flags (828-868). `workers.ts:52-57` repeats the booleans in the spawn fingerprint. `@olai/tests` depends on all five engine plugins for this alone.

**After: three moves and one fold.**

1. **The core stays generic.** `packages/tests/agent/fake-acp-agent.ts` becomes `packages/tests/agent/scripted-acp.ts`, exporting one function that takes the engine's tool vocabulary and flavour as arguments: `scripted({ tool, flavour: "claude" | "codex" })`. The two `olai-plugin-*/testlib` imports and the `OLAI_FAKE_CODEX` switch (line 381) leave it. `command.ts`, `session-store.ts`, `native-activity.ts`, `support/ndjson.ts` and `support/scripted.ts` stay where they are, reached through the `./agent/*` and `./harness/*` doors. Chat's steps keep importing `@olai/tests/agent/session-store.ts`.

2. **Each engine owns its fake** under `packages/plugins/<engine>/e2e/fake/`:

   | Engine | Files | What the executable does |
   | --- | --- | --- |
   | claude | `claude-agent-acp`, `index.ts` | `#!/usr/bin/env bun`, imports `scripted` from the door and `../../src/testlib.ts`, runs the claude flavour |
   | codex | `codex-acp`, `index.ts` | Same, codex flavour. The `OLAI_FAKE_CODEX` flag is gone; the executable is the arm |
   | opencode | `opencode`, `opencode.ts`, `index.ts` | Today's file, with `../command.ts` → `@olai/tests/agent/command.ts` and `../../support/*` → `@olai/tests/harness/*` |
   | omp | `omp`, `omp.ts`, `index.ts` | Same |
   | pi | `pi`, `pi-acp`, `pi-acp.ts`, `index.ts` | Same; the `pi` stub is unchanged |
   | kolu | `kolu`, `index.ts` | The tenant's PATH fake, moved with the same rule |

   `index.ts` is the descriptor. Its type lives at `packages/tests/support/fake.ts`, exported through the `./harness/*` door:

   ```ts
   export interface Fake {
     readonly word: string                              // the plugin's word; `@<word>` is its tag
     readonly adapter?: { readonly knob: string; readonly exe: string }  // OLAI_ACP_* → exe when asked, "" otherwise
     readonly searchPath?: string                       // a directory for OLAI_AGENT_PATH when asked
     readonly path?: string                             // a directory put first on PATH for every server
     readonly env?: (asked: { readonly on: boolean; readonly stored: boolean }) => Readonly<Record<string, string>>
   }
   ```

   pi's descriptor carries both `adapter` and `searchPath`, which is the two-halves row `hooks.ts:346-356` describes. kolu's carries `path` and an `env` returning `OLAI_FAKE_KOLU: on ? "live" : "stale"`. The `stored` flags become each descriptor's own `env`.

   Each engine's `package.json` exports the door: `"./e2e/fake": "./e2e/fake/index.ts"`. It is a static contract door in the sense `cordis.md` gives the word: paths and a pure function, no live value.

3. **The bundle generates the roster.** `packages/bundle/generate.ts` writes a fourth file, `src/fakes.generated.ts`, exported as `@olai/bundle/e2e-fakes`: for each row whose package exports `./e2e/fake`, in row order, `{ id, load: () => import("<pkg>/e2e/fake") }`. Same derivation as the browser rows (`hasDoor`), same gitignore treatment, same *one row and no second list* argument. Test-only by placement beside `./testlib` and `./tree-testlib`.

4. **The harness folds.** `hooks.ts` and `workers.ts` lose every engine constant, tag constant, boolean and variable name:

   | Was | Is |
   | --- | --- |
   | `FAKE_AGENT`, `FAKE_OPENCODE_DIR`, `FAKE_OMP_DIR`, `FAKE_PI_DIR`, `FAKE_PI_ACP`, `FAKE_KOLU_DIR` | `const FAKES = await Promise.all(ROSTER.map(...))` from `@olai/bundle/e2e-fakes`, once at load |
   | `OPENCODE_TAG`, `PI_TAG`, `OMP_TAG`, `KOLU_TAG`, `hasCodex` | `@<word>` recognised for any `word` in `FAKES` |
   | spawn options `agent`, `opencode`, `pi`, `omp`, `codex`, `kolu` | `agent?: false` (`@no-agent`) and `fakes: ReadonlySet<string>` (the words asked for) |
   | `spawnFingerprint`'s six booleans | `fakes: ReadonlyArray<string>`, sorted |
   | the env fold at 828-868 | for each `Fake`: `adapter` → `env[knob] = on ? exe : ""` where `on` is asked-for, or the default agent; `searchPath` joined into `OLAI_AGENT_PATH` when on; every `path` prefixed onto `PATH` after the broken git; `env(asked)` merged |

   **The default agent is the first row with an `adapter`.** `olai.yml` orders the engines and says the first is what a note naming no agent is read as being about; the harness reads the same order and names nobody. Today that is claude, so `OLAI_ACP_AGENT` still points at the Claude-shaped fake on every server unless `@no-agent`.

   Feature files do not change: `@codex`, `@pi`, `@omp`, `@opencode`, `@kolu`, `@no-agent`, `@agent-stored` keep their spelling and meaning.

5. **`@olai/tests`' manifest** drops `olai-plugin-claude`, `-codex`, `-opencode`, `-omp` and `-pi` from `dependencies`. It keeps `olai-plugin-kolu` and `olai-plugin-odu` for their testlibs until 13.4 is ruled on.

**Enforcement.**

- The section 9 fence corpus includes `packages/tests/support/**` and `packages/tests/agent/**`: no plugin word as a tag literal, identifier or variable, with the 13.4 allowance. `prove-fence.sh` plants `"@pi"` in `hooks.ts`.
- `packages/tests/imports.test.ts` gains the door: a plugin's `e2e/fake/**` may reach `@olai/tests/agent/*` and `@olai/tests/harness/*` and nothing else of the harness; the harness reaches a fake only through `@olai/bundle/e2e-fakes`.
- A bun test in `packages/bundle/src/` holds every generated fake entry to a package that exports the door and a descriptor whose `word` equals its row id, and holds every `adapter.knob` equal to a key in that plugin's `olai.knobs` (section 3), so the fake and the packaged wrapper cannot disagree about which variable is the row's door.
- The whole e2e suite is the behavioural proof: every chat, engine and kolu scenario spawns through the fold.

### 13.4 Left for a later ruling

`hooks.ts:370-383` also handles `@padi:<fleet>` (kolu's socket, `PADI_SOCKET`) and `@odu-service:<fleet>` (odu's origin, `ODU_WEB_ORIGIN`), each spawning a tenant's fake service from that tenant's testlib. They are the same class of spread. They are not in this PR because each is a running service with a lifetime the harness owns, not an executable on a path, and a descriptor that starts a service needs its own ownership argument. Recorded as the fence's one allowance in that corpus, with this paragraph as the reason.

---

## 14. Decisions taken

Ruled by the human on 2026-09-15, through the question tool.

| Question | Decision |
| --- | --- |
| Split the root `acp/` shim per engine? | **Yes.** Two FODs, two hashes; a pi bump no longer moves claude's path. `acp/README.md`'s one-lockfile argument is retired with the file. |
| Rename `acp-agent` to `claude-agent` and `pi-agent`? | **Yes, no alias.** |
| Where is a knob declared? | **`package.json` `olai.knobs`**, read by nix and held equal to `server.ts` by a bun test. |
| Who owns the `odu` flake output the CI runner uses? | **The odu plugin**, with a comment that it is also the CI runner. |
| How does the odu surface check run? | **Sandboxed flake check**, with a dev-shell `devChecks` arm as the fallback, reported in the PR body. |
| The three non-Nix spreads? | **All three in this PR** (section 13). |
| Where does this plan live? | **Uncommitted at the worktree root.** |
