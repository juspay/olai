/**
 * PI'S FAKE DESCRIPTOR — the one fact this plugin contributes to the harness
 * fold (section 13.3). Pi is hybrid: it ships BOTH halves, and how far the
 * harness goes depends on the scenario.
 *
 *   - A linked (or default) scenario needs `pi-acp`, which pi's plugin code
 *     spawns directly — so this row declares it as the `adapter`, the only
 *     other kind besides opencode and omp whose panel command the fold can
 *     point at an executable by knob.
 *   - An UNLINKED scenario only needs `pi` (the probe) on the agent path to
 *     offer the link flow — so the fold sets the adapter knob to the empty
 *     string (off means off), and `searchPath` still joins the agent path.
 *
 * `env` turns the harness's `@agent-stored` flag into the stored-sessions env
 * this engine's core reads.
 */
import { resolve } from "node:path";
import type { Fake } from "@olai/tests/harness/fake.ts";

export const fake: Fake = {
  word: "pi",
  adapter: {
    knob: "OLAI_ACP_PI",
    exe: resolve(import.meta.dirname, "pi-acp"),
  },
  searchPath: import.meta.dirname,
  env: ({ on, stored }): Readonly<Record<string, string>> =>
    on && stored ? { OLAI_FAKE_PI_STORED: "yes" } : {},
};