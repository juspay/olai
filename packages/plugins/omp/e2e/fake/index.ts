/**
 * OMP'S FAKE DESCRIPTOR — the one fact this plugin contributes to the harness
 * fold (section 13.3). Oh My Pi is found PROBE-style, exactly the way
 * opencode is: a probe runs `omp` found on the agent path, and the harness
 * wraps that command line into adapter kind `omp`. The `searchPath` below is
 * the directory holding this engine's scripted executable; `@omp` is the word
 * a scenario's tags vote for. There is no adapter knob because the probe, not
 * a fixed command, is what reaches the fake.
 */
import type { Fake } from "@olai/tests/harness/fake.ts";

export const fake: Fake = {
  word: "omp",
  searchPath: import.meta.dirname,
  env: ({ on, stored }): Readonly<Record<string, string>> =>
    on && stored ? { OLAI_FAKE_OMP_STORED: "yes" } : {},
};