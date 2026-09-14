/**
 * Cucumber profiles. `--profile ui` is the only one: the features drive a real
 * browser against a real server, which is the whole point of this package.
 *
 * Everything below is a knob rather than a constant because the same profile
 * has to serve four callers — a laptop running one feature, `just check`
 * running all of them, a remote host running one shard, and a bisect run that
 * wants only the scenarios it knows are flaky.
 */

import { workerCount } from "./support/parallelism.js";

// Unset: derived from the machine (`os.availableParallelism() - 1`, cap 4).
// `CUCUMBER_PARALLEL` is the override, including `=1` for a serial run.
const parallel = workerCount();

// Only set default paths when no feature file was passed on the CLI. A profile
// that hardcodes `paths` silently wins over the positional argument, so
// `cucumber-js ../plugins/vault/e2e/features/error_view.feature` would run the
// whole suite. Matches the line-targeted form (`foo.feature:42:56`) too — missing that would broaden
// the run back to everything in exactly the case where a person is narrowing it.
const cliHasFeatureArgs = process.argv
  .slice(2)
  .some((a) => /\.feature(?::\d+)*$/.test(a));

// WHERE THE SUITE LIVES, which is two places and not one.
//
// A feature is a promise, and a promise has an owner: each plugin keeps the
// features it promises and the steps that drive its own surface under its own
// `e2e/` directory, so a change to one row is a diff inside that row. What is
// left here is the harness (world, hooks, scratch, the scripted agents) and the
// features no single row owns — the shell, the wire, the plugin system.
//
// Both globs are RELATIVE TO THIS PACKAGE, because that is cucumber's cwd (the
// `e2e` recipe `cd`s here, and so does a person). Climbing out of it is not a
// smell: the runner is one process for the whole suite whatever tree the files
// sit in, and the alternative — a cucumber per plugin — would be thirty
// Chromiums and thirty servers for one run.
const HARNESS_FEATURES = "features/**/*.feature";
const PLUGIN_FEATURES = "../plugins/*/e2e/features/**/*.feature";
const HARNESS_STEPS = "step_definitions/**/*.ts";
const PLUGIN_STEPS = "../plugins/*/e2e/steps/**/*.ts";
const SUPPORT = "support/**/*.ts";

// `@skip` marks a scenario kept as a harness for known-broken behaviour, so it
// is out of the default run. CUCUMBER_TAGS REPLACES this rather than adding to
// it — `CUCUMBER_TAGS='@skip'` is how you run only those.
const tags = process.env.CUCUMBER_TAGS || "not @skip";

// Scenario retry budget. Off by default so a local run shows a real failure the
// first time; CI may set `CUCUMBER_RETRY=1` to absorb a genuinely flaky lane.
// A retry that hides a reproducible failure is worse than a red run.
const retry = parseInt(process.env.CUCUMBER_RETRY || "0", 10);

// Odu gives each borrowed execution slot one slice of the same scenario list.
// Cucumber owns the assignment: its native sharder distributes pickles
// round-robin, so an outline's expanded examples count and a feature move does
// not leave a hand-maintained partition lopsided.
const shard = process.env.CUCUMBER_SHARD || "";

export const ui = {
  ...(!cliHasFeatureArgs && { paths: [HARNESS_FEATURES, PLUGIN_FEATURES] }),
  // The STEPS are always all of them, feature argument or not: a step is a
  // global vocabulary entry, and `see_the_outline.feature` says "the node is
  // shown" whoever owns the row that draws it.
  import: [HARNESS_STEPS, PLUGIN_STEPS, SUPPORT],
  tags,
  // progress-bar (stdout): how far along the run is.
  // pretty (stderr): the failing step, inline, the moment it fails — so a CI log
  // read from the top tells you what broke without scrolling to a summary.
  format: ["progress-bar", "pretty:/dev/stderr"],
  formatOptions: { snippetInterface: "async-await" },
  ...(parallel > 1 && { parallel }),
  ...(retry > 0 && { retry }),
  ...(shard !== "" && { shard }),
};

export default {};
