import { expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

const HERE = import.meta.dirname;

const testScript: string = JSON.parse(
  fs.readFileSync(path.join(HERE, "package.json"), "utf8"),
).scripts.test;

test("PIN (runner): the suite is handed to bun, not to a shebang", () => {
  expect(testScript.startsWith("bun ")).toBe(true);
  expect(testScript).not.toMatch(/(?:^|[\s/])cucumber-js\b/);
});

test("PIN (runner): the file it names is cucumber's entry, and it is there", () => {
  const [, entry = ""] = testScript.split(/\s+/);
  expect(entry).toBe("./node_modules/@cucumber/cucumber/bin/cucumber.js");
  expect(fs.existsSync(path.join(HERE, entry))).toBe(true);
});
