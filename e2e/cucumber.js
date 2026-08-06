// cucumber-js configuration. `just e2e` runs it; nothing else does.
//
// No `paths`: cucumber already defaults to features/**/*.feature, and the key
// is ADDITIVE in the merge — spelling the same glob here would concatenate
// with a feature named on the command line rather than be replaced by it.

export default {
  import: ["steps/**/*.js", "support/**/*.js"],

  // @skip is the regression harness for behaviour that is known-broken: the
  // scenario is written, and it is not run. CUCUMBER_TAGS replaces this
  // outright (a --tags on the command line is ANDed with it, so that one can
  // only narrow): `CUCUMBER_TAGS=@skip just e2e` runs exactly those.
  tags: process.env.CUCUMBER_TAGS || "not @skip",

  // Off by default: a flake that only shows up on the second attempt is a bug
  // report, and a developer should see it. CI sets a budget (ci/mod.just).
  retry: parseInt(process.env.CUCUMBER_RETRY || "0", 10),

  // Every scenario boots its own server on its own port against its own temp
  // dir, so workers share nothing. 0 is cucumber's "no workers"; CI picks a
  // small number rather than the box's, because the racket lanes run beside it.
  parallel: parseInt(process.env.CUCUMBER_PARALLEL || "0", 10),

  // A progress bar redraws itself, which a CI log cannot do.
  format: [process.stdout.isTTY ? "progress-bar" : "progress", "summary"],
  formatOptions: { snippetInterface: "async-await" },
};
