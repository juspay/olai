import * as path from "node:path";

import { expect, test } from "bun:test";

import { read, tracked, withoutComments } from "./support/sweep.ts";

const OWN = /^packages\/(?:tests\/.+\.ts|plugins\/[^/]+\/e2e\/.+\.ts)$/;

const AT_THE_CLIENT = /from\s+"(@olai\/web[^"]*)"/g;

const DOOR = "@olai/web/testlib";

test("no file in the suite reaches the client past ./testlib", () => {
  const found = tracked(import.meta.filename)
    .filter((file) => OWN.test(file))
    .flatMap((file) =>
      [...withoutComments(read(file)).matchAll(AT_THE_CLIENT)].flatMap(
        (hit) =>
          hit[1] === DOOR
            ? []
            : [`${file}: ${hit[1]}`],
      )
    );
  expect(found).toEqual([]);
});

const IN_A_ROW = /^packages\/plugins\/[^/]+\/e2e\/(?:.+\.ts|fake\/[^.]+)$/;

const HARNESS_DOOR = /^@olai\/tests\/(?:harness|agent)\/[^"]+$/;

test("a row's e2e reaches the harness through its door, and never around it", () => {
  const found = tracked(import.meta.filename)
    .filter((file) => IN_A_ROW.test(file))
    .flatMap((file) => {
      const code = withoutComments(read(file));
      const named = [...code.matchAll(/["'](@olai\/tests[^"']*)["']/g)]
        .flatMap((hit) => (hit[1] === undefined || HARNESS_DOOR.test(hit[1]) ? [] : [hit[1]]));
      const climbed = [...code.matchAll(/["']((?:\.\.\/){3,}[^"']*)["']/g)]
        .flatMap((hit) => (hit[1] === undefined ? [] : [hit[1]]));
      return [...named, ...climbed].map((spec) => `${file}: ${spec}`);
    });
  expect(found).toEqual([]);
});

const relativesOf = (file: string): ReadonlyArray<string> =>
  [
    ...withoutComments(read(file)).matchAll(
      /(?:\bfrom\s*|^\s*import\s*|\bimport\(\s*|\brequire\(\s*)["']([^"'\n]+)["']/gm,
    ),
  ]
    .flatMap((hit) => (hit[1] === undefined ? [] : [hit[1]]))
    .filter((one) => one.startsWith("."));

const beside = (file: string, specifier: string): string =>
  path.posix.normalize(`${path.posix.dirname(file)}/${specifier}`);

test("the door reaches no component", () => {
  const seen = new Set<string>();
  const found: Array<string> = [];
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const specifier of relativesOf(file)) {
      const sibling = beside(file, specifier);
      if (sibling.endsWith(".tsx")) {
        found.push(`${file}: ${specifier}`);
      } else {
        visit(sibling);
      }
    }
  };
  visit("packages/web/src/suite.testlib.ts");
  expect(found).toEqual([]);
});
