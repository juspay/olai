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
 */
import { resolve } from "node:path";
import type { Fake } from "@olai/tests/harness/fake.ts";

export const fake: Fake = {
  word: "claude",
  adapter: {
    knob: "OLAI_ACP_AGENT",
    exe: resolve(import.meta.dirname, "claude-agent-acp"),
  },
  env: ({ stored }) => stored ? { OLAI_FAKE_ACP_STORED: "yes" } : {},
};