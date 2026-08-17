/**
 * Pins on WHO runs the runner. Bun executes the step definitions' TypeScript
 * natively; node does not, and refuses the raw-TypeScript @kolu/* sources
 * outright (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING). So the one thing
 * that must not regress is the interpreter — and it regresses INVISIBLY on
 * the machines that do not have a node, which is where a regression would be
 * written and reviewed.
 *
 * The sabotage target is `test` going back to a bin name: `cucumber-js` is a
 * shebang file, and `bun run` executes a package script's argv rather than
 * interpreting it, so `#!/usr/bin/env node` is resolved against PATH. Bun's
 * own `node`-to-bun shim covers that only when the host has no node — so the
 * bin name passes on a node-free box and dies on a developer's laptop, inside
 * `nix develop .#e2e` as much as outside it, since the shell APPENDS the
 * host's PATH. Naming the .js file makes bun the interpreter unconditionally,
 * which is why this pin reads the manifest rather than running anything.
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
