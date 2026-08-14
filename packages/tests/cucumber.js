/**
 * Cucumber profiles. `--profile ui` is the only one: the features drive a real
 * browser against a real server, which is the whole point of this package.
 *
 * Everything below is a knob rather than a constant because the same profile
 * has to serve three callers — a laptop running one feature, `just check`
 * running all of them, and a bisect run that wants only the scenarios it
 * knows are flaky.
 */

import { workerCount } from "./support/parallelism.js";

// Unset: derived from the machine (`os.availableParallelism() - 1`, cap 4).
// `CUCUMBER_PARALLEL` is the override, including `=1` for a serial run.
const parallel = workerCount();

// Only set default paths when no feature file was passed on the CLI. A profile
// that hardcodes `paths` silently wins over the positional argument, so
// `cucumber-js features/error_view.feature` would run the whole suite. Matches
// the line-targeted form (`foo.feature:42:56`) too — missing that would broaden
// the run back to everything in exactly the case where a person is narrowing it.
const cliHasFeatureArgs = process.argv
  .slice(2)
  .some((a) => /\.feature(?::\d+)*$/.test(a));

// `@skip` marks a scenario kept as a harness for known-broken behaviour, so it
// is out of the default run. CUCUMBER_TAGS REPLACES this rather than adding to
// it — `CUCUMBER_TAGS='@skip'` is how you run only those.
const tags = process.env.CUCUMBER_TAGS || "not @skip";

// Scenario retry budget. Off by default so a local run shows a real failure the
// first time; CI may set `CUCUMBER_RETRY=1` to absorb a genuinely flaky lane.
// A retry that hides a reproducible failure is worse than a red run.
const retry = parseInt(process.env.CUCUMBER_RETRY || "0", 10);

export const ui = {
  ...(!cliHasFeatureArgs && { paths: ["features/**/*.feature"] }),
  import: ["step_definitions/**/*.ts", "support/**/*.ts"],
  tags,
  // progress-bar (stdout): how far along the run is.
  // pretty (stderr): the failing step, inline, the moment it fails — so a CI log
  // read from the top tells you what broke without scrolling to a summary.
  format: ["progress-bar", "pretty:/dev/stderr"],
  formatOptions: { snippetInterface: "async-await" },
  ...(parallel > 1 && { parallel }),
  ...(retry > 0 && { retry }),
};

export default {};
