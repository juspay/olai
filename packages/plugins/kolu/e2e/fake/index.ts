import type { Fake } from "@olai/tests/harness/fake.ts";

export const fake: Fake = {
  word: "kolu",
  path: import.meta.dirname,
  env:
    ({ on }): Readonly<Record<string, string>> =>
      ({ OLAI_FAKE_KOLU: on ? "live" : "stale" }),
};