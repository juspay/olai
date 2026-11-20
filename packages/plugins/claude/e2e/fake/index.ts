import { resolve } from "node:path";
import type { Fake } from "@olai/tests/harness/fake.ts";

export const fake: Fake = {
  word: "claude",
  adapter: {
    knob: "KOLU_ACP_AGENT",
    exe: resolve(import.meta.dirname, "claude-agent-acp"),
  },
  env: ({ stored }): Readonly<Record<string, string>> => ({
    ...(stored ? { OLAI_FAKE_ACP_STORED: "yes" } : {}),
    SSH_CONNECTION: "10.0.0.1 40222 10.0.0.2 22",
    CLAUDE_CODE_DISABLE_AUTO_MEMORY: "0",
  }),
};