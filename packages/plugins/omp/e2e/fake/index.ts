import type { Fake } from "@olai/tests/harness/fake.ts";

export const fake: Fake = {
  word: "omp",
  searchPath: import.meta.dirname,
  env: ({ on, stored }): Readonly<Record<string, string>> =>
    on && stored ? { OLAI_FAKE_OMP_STORED: "yes" } : {},
};