/**
 * CODEX'S FAKE DESCRIPTOR — the one fact this plugin contributes to the
 * harness fold (section 13.3). `adapter.exe` is this package's scripted
 * executable, resolved here because this engine owns its own path; `env`
 * turns the harness's `@agent-stored` flag into the stored-sessions env this
 * engine's core reads. (Claude's descriptor contributes the same variable on
 * the same rule, which is fine — the wrapped CLI a scenario isn't pointed at
 * never boots, and both rows sharing the core means both read the one flag.)
 */
import { resolve } from "node:path";
import type { Fake } from "@olai/tests/harness/fake.ts";

export const fake: Fake = {
  word: "codex",
  adapter: {
    knob: "OLAI_ACP_CODEX",
    exe: resolve(import.meta.dirname, "codex-acp"),
  },
  env: ({ stored }) => stored ? { OLAI_FAKE_ACP_STORED: "yes" } : {},
};