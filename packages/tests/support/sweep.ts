import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export const ROOT = path.dirname(path.dirname(path.dirname(import.meta.dirname)));

export const tracked = (self: string): ReadonlyArray<string> => {
  const listed = spawnSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" });
  if (listed.status !== 0) {
    throw new Error(`git ls-files failed in ${ROOT}: ${listed.stderr || listed.error}`);
  }
  const mine = path.relative(ROOT, self);
  return listed.stdout.split("\0").filter((one) => one !== "" && one !== mine);
};

export const withoutComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/[^\n]*/g, (_taken, lead) => lead ?? "");

export const read = (file: string): string =>
  fs.readFileSync(path.join(ROOT, file), "utf8");

export const exists = (file: string): boolean =>
  fs.existsSync(path.join(ROOT, file));

export const granting = (
  allowed: ReadonlyArray<string>,
): ((file: string) => boolean) =>
(file: string) =>
  allowed.some((one) => (one.endsWith("/") ? file.startsWith(one) : file === one));

export const unresolved = (
  allowed: ReadonlyArray<string>,
): ReadonlyArray<string> =>
  allowed.filter((one) => !exists(one.endsWith("/") ? one.slice(0, -1) : one));
