import { workerCount } from "./support/parallelism.js";

const parallel = workerCount();

// Only set default paths when no feature file was passed on the CLI. A profile
// that hardcodes `paths` silently wins over the positional argument, so
// `cucumber-js ../plugins/vault/e2e/features/error_view.feature` would run the
// whole suite. Matches the line-targeted form (`foo.feature:42:56`) too — missing that would broaden
// the run back to everything in exactly the case where a person is narrowing it.
const cliHasFeatureArgs = process.argv
  .slice(2)
  .some((a) => /\.feature(?::\d+)*$/.test(a));

const HARNESS_FEATURES = "features/**/*.feature";
const PLUGIN_FEATURES = "../plugins/*/e2e/features/**/*.feature";
const HARNESS_STEPS = "step_definitions/**/*.ts";
const PLUGIN_STEPS = "../plugins/*/e2e/steps/**/*.ts";
const SUPPORT = "support/**/*.ts";

const tags = process.env.CUCUMBER_TAGS || "not @skip";

const retry = parseInt(process.env.CUCUMBER_RETRY || "0", 10);

const shard = process.env.CUCUMBER_SHARD || "";

export const ui = {
  ...(!cliHasFeatureArgs && { paths: [HARNESS_FEATURES, PLUGIN_FEATURES] }),
  import: [HARNESS_STEPS, PLUGIN_STEPS, SUPPORT],
  tags,
  format: ["progress-bar", "pretty:/dev/stderr"],
  formatOptions: { snippetInterface: "async-await" },
  ...(parallel > 1 && { parallel }),
  ...(retry > 0 && { retry }),
  ...(shard !== "" && { shard }),
};

export default {};
