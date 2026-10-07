/**
 * CLAUDE'S FAKE DESCRIPTOR — the one fact this plugin contributes to the
 * harness fold (section 13.3). The type lives at `@olai/tests/harness/fake.ts`;
 * nothing here names another engine, and nothing in the harness names this
 * engine's knob or executable except through these two fields.
 *
 * `adapter.exe` is the scripted executable beside this file, resolved here
 * (rather than spelled by the harness) because this plugin owns its own path.
 * `env` turns the harness's `@agent-stored` flag into the stored-sessions env
 * this engine's core reads.
 *
 * IT ALSO ARMS ONE OF THE FIVE VARIABLES THE ADAPTER READS AS "REMOTE" —
 * `SSH_CONNECTION`, which is set on the SERVER this row starts, and would
 * therefore be inherited by the adapter unless this engine's own registration
 * takes it away (`Adapter.unset`, `../src/server.ts`). The fake adapter mimics
 * that test (`acp-agent.js`: on a remote session it offers only a full-screen
 * login), so a regression in the strip shows up as a sign-in method that is no
 * longer offered rather than as a fact about whatever machine CI happens to
 * run on.
 */
import { resolve } from "node:path";
import type { Fake } from "@olai/tests/harness/fake.ts";

export const fake: Fake = {
  word: "claude",
  adapter: {
    knob: "OLAI_ACP_AGENT",
    exe: resolve(import.meta.dirname, "claude-agent-acp"),
  },
  env: ({ stored }): Readonly<Record<string, string>> => ({
    ...(stored ? { OLAI_FAKE_ACP_STORED: "yes" } : {}),
    SSH_CONNECTION: "10.0.0.1 40222 10.0.0.2 22",
    // THE OPERATOR'S CONTRARY EXPORT, on olai's own environment — the value
    // an operator who WANTED Claude's automatic memory on would have: this
    // engine's `at` sets the switch unconditionally over it, and the fake's
    // `memory` answer proves that merge won — the same rule `agent.ts`'s
    // env-wins test pins. A regression shows up as the fake reporting its
    // memory ON rather than as a fact about CI.
    CLAUDE_CODE_DISABLE_AUTO_MEMORY: "0",
  }),
};