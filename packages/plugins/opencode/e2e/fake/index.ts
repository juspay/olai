import type { Fake } from "@olai/tests/harness/fake.ts";

export const fake: Fake = {
  word: "opencode",
  searchPath: import.meta.dirname,
  env: ({ on, stored }): Readonly<Record<string, string>> =>
    on && stored ? { OLAI_FAKE_OPENCODE_STORED: "yes" } : {},
};