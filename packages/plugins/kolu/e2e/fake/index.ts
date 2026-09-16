/**
 * KOLU'S FAKE DESCRIPTOR — the one fact this plugin contributes to the
 * harness fold (section 13.3). Kolu is the tenant that runs CHAT as a
 * subprocess, not an agent olai spawns: its fake `kolu` only has to sit ON
 * `PATH` for the harness to reach it. So there is no adapter knob and no
 * agent-path join — only `path`, prepended to the server's `PATH` whenever
 * the scenario is `@kolu`, and that path is the directory beside this file.
 * `@kolu` scenarios come with their own corpus, so the fold does not need to
 * point kolu at a directory — but the suite still has to tell the fake's
 * subprocess when it is live. Kolu always answers, even when off, so `env`
 * carries `OLAI_FAKE_KOLU` as `"live"` vs `"stale"` (never absent): a test
 * that must not touch a live kolu sees `stale`, one that must sees `live`.
 */
import type { Fake } from "@olai/tests/harness/fake.ts";

export const fake: Fake = {
  word: "kolu",
  path: import.meta.dirname,
  env:
    ({ on }): Readonly<Record<string, string>> =>
      ({ OLAI_FAKE_KOLU: on ? "live" : "stale" }),
};