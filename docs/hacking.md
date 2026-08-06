# Hacking

Facts an agent cannot infer from the code and would otherwise probe for.
Not a tutorial. Read README and docs/cli.md first.

## Toolchain

* Racket comes from `nix develop` (nixpkgs 9.2). `just` recipes set
  `PLTUSERHOME` to `$PWD/.plt-user` so user packages and the `olai` link
  live in the worktree, not `~`. That directory must be writable.
* `just install` — deps + `raco pkg install --skip-installed --link olai/`.
  Cheap to repeat. Does **not** recompile after you edit sources.
* `just build` — `raco setup --pkgs olai`. Writes `compiled/*.zo` for the
  collection and its tests, and keeps them coherent after edits.
  Incremental when nothing changed. `just test` / `test-integration` /
  `test-all` depend on it.
* `just clean` — delete every `olai/**/compiled`. Escape hatch only.

### Why build exists

This Racket does **not** write `.zo` on load. `racket -e '(require …)'`
and a bare `raco test` leave no bytecode on disk; every run recompiles
in memory. Measured baseline (16 cores, 184 unit tests):

| path | wall |
|---|---|
| `just test` with no `.zo` | ~22 s |
| `just test` after `just build` | ~5.5–6 s |
| edit `olai/web/style.rkt` → `just test` (with build) | ~6–9 s |

So the agent edit-verify loop is dominated by missing bytecode, not by
the suite. Build once; keep it.

### Stale `.zo` / linklet mismatch

Symptom:

```
instantiate-linklet: mismatch;
 reference to a variable that is not exported
  …
  possible reason: modules need to be recompiled because dependencies changed
  possible solution: running `racket -y`, `raco make`, or `raco setup`
```

Cause: a low-level module was recompiled (or its exports changed) while
a dependent's `.zo` still expects the old linklet — classic after
editing `web/style.rkt` / `web/theme.rkt` and only partially rebuilding.

Cure, in order:

1. `just build` (what `just test` already runs)
2. if still broken: `just clean && just build`
3. never hand-delete a single `*_rkt.zo` and leave the rest

## css-expr (web/style.rkt and friends)

The sheet is generated; the serializer is css-expr's. Rules that are not
obvious from the package docs:

* **Hex colors** must be escaped symbols: `|#E4ECCA|`, not `"#E4ECCA"`
  or `#E4ECCA`. See the theme tables in `olai/web/theme.rkt`.
* **Multi-value properties** (e.g. `box-shadow` layers, `transition`
  lists) are **comma**-joined by the serializer.
* **Parenthesized groups** inside a property (function args, nested
  value lists) are **space**-joined.
* **`@media` / `@keyframes`** are spelled as css-expr at-rules, not raw
  strings when the form can express them:

  ```racket
  [@ media (#:max-width ,phone-max) #:padding-right 1rem]
  [@ keyframes ol-spin [to #:transform (apply rotate 360deg)]]
  ```

* **`apply`** is css-expr's way to emit a CSS function:
  `(apply color-mix (in srgb) (,green 45%) transparent)` →
  `color-mix(in srgb, …)`.
* **Raw CSS strings** are the escape hatch (`register-fragment!` with a
  string). Use only when css-expr cannot spell it; comment why. The
  generated-file banner in `theme.rkt` is the one permanent example.
* **Cascade order** is not CSS `@layer`. It is (1) fragment layer
  `'base` | `'component` | `'overlay`, then (2) module instantiation
  order (= require order through `olai/web/skin.rkt`). A class is
  defined in the module that **draws** it.

Class-name renames: run `just css-classes` to regenerate
`olai/tests/classes.golden`; never edit the golden by hand.

## Tests

* `just test` — unit, in-process, `olai/tests/*.rkt`
* `just test-integration` — spawns `olai`, boots servers
* `just test-all` — both, one `-j` pool
* `just e2e` — browser journeys (see below); never in `just test`
* Parse JSON with `read-json`. Never string-match JSON.
* Personal outline data is `$OLAI_HOME` (outside the repo). CI and
  tests use `examples/` only.

## e2e (browser)

`e2e/` is cucumber-js + Playwright over a real headless Chromium: the
journeys the racket tests cannot see, because they stop at HTTP and no
JS runs there — folding, the theme picker, the live re-swap, the chat
panel's geometry.

* `just e2e` runs the suite; arguments go straight to cucumber, so
  `just e2e features/chat.feature` and `just e2e features/chat.feature:12`
  both work. `--tags` on the command line is ANDed with the profile's
  `not @skip`, so it can only ever narrow: to run a skipped scenario,
  replace the filter — `CUCUMBER_TAGS='@skip' just e2e`.
* It is **not** in `just test` (that stays the fast racket set) and it
  is its own CI node (`ci/mod.just`, Linux only).
* Node, the browser and the harness's `node_modules` come from a
  SEPARATE devShell (`nix develop .#e2e`); the recipe enters it itself.
  Nothing racket-only pays for a 500 MB browser.
* `e2e/package.json` pins `playwright` to the same version as nixpkgs'
  `playwright-driver` (the browser bundle `PLAYWRIGHT_BROWSERS_PATH`
  points at). Bump them together or scenario one says "Executable
  doesn't exist".
* Deps are a derivation (`e2e/default.nix`, one fixed-output
  `fetchNpmDeps`, like `acp/`); the regenerate-the-hash recipe is in
  that file's header, next to the hash it is about.
* The fixture outline is a real file, `e2e/fixtures/Tasks.rkt`, checked
  by the `smoke` lane like any other committed outline.
* Each scenario gets its own temp outline, its own `olai serve` on an
  ephemeral port (`--port 0`; the server prints the port it took), and
  a fresh browser context — so localStorage, folds and prefs start
  empty every time.
* The agent is ALWAYS `olai/tests/integration/fake-acp-agent.rkt`
  (`e2e/support/server.js` sets `OLAI_ACP_AGENT`). No real Claude Code
  is ever spawned by a test. What it woke up with is a scenario TAG —
  `@stored-sessions`, `@foreign-sessions` — because stored
  conversations are a fact about the machine, not something a step can
  arrange later (`e2e/support/hooks.js`).
* `serve` answers requests while the agent is still booting. What the
  panel comes up knowing is not a page's to say — `/events` catches a
  connection up as it is made — so `Given the agent has woken up`
  (`world.waitForAgent`, which reads the stream) is for scenarios about
  the AGENT: the picker asks it, and there is nothing to ask until it
  is up.
* `@skip` is the regression harness for known-broken behaviour: the
  scenario is written and excluded. `CUCUMBER_TAGS=@skip just e2e` runs
  exactly those. `CUCUMBER_RETRY` (CI sets 1) and `CUCUMBER_PARALLEL`
  are the other two knobs.
* Assert behaviour and geometry, never pixel snapshots.
