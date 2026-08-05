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
* Parse JSON with `read-json`. Never string-match JSON.
* Personal outline data is `$OLAI_HOME` (outside the repo). CI and
  tests use `examples/` only.
