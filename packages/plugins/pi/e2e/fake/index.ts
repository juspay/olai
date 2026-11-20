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