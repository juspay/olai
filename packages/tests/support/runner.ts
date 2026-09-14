/**
 * THE RUNNER'S DOOR — the one specifier a step file names to register a step.
 *
 * A step definition no longer lives in this package: each plugin owns the
 * features it promises and the steps that drive its surface
 * (`packages/plugins/<name>/e2e/`). Those files still have to register with the
 * SAME cucumber instance the runner booted, and they resolve their imports from
 * their own package rather than from this one — so a plugin spelling
 * `@cucumber/cucumber` would need the dependency in its own manifest, and a
 * SECOND copy of the runner in the tree is a step file that registers with
 * nobody and a suite that reports it undefined.
 *
 * Worse in practice: `playwright` beside it is version-PINNED to the Nix
 * `playwright-driver` (see this package's manifest), and thirty manifests
 * carrying that pin is thirty places for it to drift the day nixpkgs moves.
 *
 * So the runner is a door of this package, like every other harness name: a
 * plugin declares `@olai/tests` and nothing else, and the one copy of cucumber
 * is the one this package installs. Re-exporting is not a wrapper — these are
 * the library's own bindings, so a step reads exactly as it did.
 */

export {
  After,
  AfterAll,
  AfterStep,
  Before,
  BeforeAll,
  BeforeStep,
  DataTable,
  defineParameterType,
  Given,
  setDefaultTimeout,
  Status,
  Then,
  When,
} from "@cucumber/cucumber";
