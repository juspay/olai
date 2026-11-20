import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test } from "bun:test";

import { ROOT } from "./support/sweep.ts";

const DOC = path.join(ROOT, "website", "docs", "dynamic-plugins-examples.md");
const FIXTURE = path.join(ROOT, "packages", "tests", "fixtures", "morning-agenda", "plugins", "morning-agenda", "server.ts");

const CLOCK: ReadonlyArray<readonly [fixture: string, doc: string]> = [
  ["const AT_HOUR = 0", "const AT_HOUR = 7"],
  [`const EVERY = "1 second"`, `const EVERY = "5 minutes"`],
];

test("the fixture's morning agenda is the doc's, with the two clock lines swapped", () => {
  let source = fs.readFileSync(FIXTURE, "utf8").trimEnd();
  for (const [fixture, doc] of CLOCK) {
    expect(source).toContain(fixture);
    source = source.replace(fixture, doc);
  }
  const page = fs.readFileSync(DOC, "utf8");
  if (page.includes(source)) return;
  const wandered = source.split("\n").find((line) => !page.includes(line));
  throw new Error(
    `fixtures/morning-agenda/ has drifted from website/docs/dynamic-plugins-examples.md.\n`
      + `The first line of the fixture's server half the page does not carry:\n`
      + `  ${wandered ?? "(every line is on the page, so the drift is in their order)"}\n`
      + `Regenerate the fixture from the page, or change the page.`,
  );
});
