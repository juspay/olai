/**
 * Pins on WHO runs the runner: `test` hands the suite to bun by naming
 * cucumber's entry file, never the `cucumber-js` bin whose shebang says node.
 * README.md is where why that matters is written down.
 *
 * WHY A UNIT PIN, when the e2e leg runs this script for real every time: the
 * bin name PASSES on a box with no node, because bun's own shim stands in
 * then. So the regression is invisible exactly where it would be written and
 * reviewed, and a leg that only fails on some machines is worth less here than
 * an assertion that fails on all of them. Hence a pin that reads the manifest
 * rather than running anything.
 */

import { expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

const HERE = import.meta.dirname;

/** The `test` script this package's manifest declares. */
const testScript: string = JSON.parse(
  fs.readFileSync(path.join(HERE, "package.json"), "utf8"),
).scripts.test;

test("PIN (runner): the suite is handed to bun, not to a shebang", () => {
  expect(testScript.startsWith("bun ")).toBe(true);
  // The bin name is the regression, however it is reached — bare on PATH or
  // spelled through `.bin/`. It is the shebang file, and the shebang says node.
  expect(testScript).not.toMatch(/(?:^|[\s/])cucumber-js\b/);
});

test("PIN (runner): the file it names is cucumber's entry, and it is there", () => {
  const entry = testScript.split(/\s+/)[1];
  expect(entry).toBe("./node_modules/@cucumber/cucumber/bin/cucumber.js");
  // Not just well-spelled: a cucumber upgrade that moves this file has to
  // fail here, in a second, rather than in the e2e leg minutes later.
  expect(fs.existsSync(path.join(HERE, entry))).toBe(true);
});
