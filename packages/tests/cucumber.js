import { workerCount } from "./support/parallelism.js";

const parallel = workerCount();

// `paths` is an ADDITIVE array in cucumber's config merge, so a profile that
// sets it is concatenated with the positional feature argument rather than
// replaced by it: `cucumber-js one.feature` would run the whole suite as well.
// The line-targeted form (`foo.feature:42:56`) is a feature argument too.
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
