import { resolve } from "node:path";
import type { Fake } from "@olai/tests/harness/fake.ts";

export const fake: Fake = {
  word: "codex",
  adapter: {
    knob: "OLAI_ACP_CODEX",
    exe: resolve(import.meta.dirname, "codex-acp"),
  },
  env: ({ stored }): Readonly<Record<string, string>> => ({
    ...(stored ? { OLAI_FAKE_ACP_STORED: "yes" } : {}),
    CODEX_CONFIG: JSON.stringify({ features: { memories: true }, model: "gpt-5" }),
  }),
};