/**
 * KOLU'S FAKE DESCRIPTOR — the one fact this plugin contributes to the
 * harness fold (section 13.3). Kolu is the tenant that runs CHAT as a
 * subprocess, not an agent olai spawns: its fake `kolu` only has to sit ON
 * `PATH` for the harness to reach it. So there is no adapter knob and no
 * agent-path join — only `path`, prepended to the server's `PATH` whenever
 * the scenario is `@kolu`, and that path is the directory beside this file.
 *
 * `@kolu` scenarios come with their own corpus; the fold does not need an env
 * for this tenant, so `env` is left off entirely.
 */
import type { Fake } from "@olai/tests/harness/fake.ts";

export const fake: Fake = {
  word: "kolu",
  path: import.meta.dirname,
};