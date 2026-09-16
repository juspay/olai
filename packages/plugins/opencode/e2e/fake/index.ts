/**
 * OPENCODE'S FAKE DESCRIPTOR — the one fact this plugin contributes to the
 * harness fold (section 13.3). An opencode is found PROBE-style: the harness
 * finds it on `OLAI_AGENT_PATH` and wraps the probe's command line into the
 * adapter kind `opencode`. So there is no `adapter` knob here — the
 * `searchPath` this row returns is how the server reaches the executable
 * beside this file, and `@opencode` is the word a scenario's tags vote for.
 */
import type { Fake } from "@olai/tests/harness/fake.ts";

export const fake: Fake = {
  word: "opencode",
  searchPath: import.meta.dirname,
};