/**
 * Pins on feature-shared scratch: the tag grammar, the hash-diff, the
 * collision sentence. Each test is a sabotage target — if `@own-scratch`
 * without `@share-scratch` is silently ignored, if two writers of the same
 * file do not name each other, the named assertion is what goes red.
 */

import { expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  changedFiles,
  collisionError,
  DEFAULT_CORPUS,
  filesOf,
  OWN_TAG,
  overlapWith,
  requestOf,
  SHARE_TAG,
  spawnFingerprint,
} from "./support/scratch.ts";

const tags = (...names: string[]) => names.map((name) => ({ name }));

test("PIN (default corpus): an untagged scenario is the good corpus, read-only", () => {
  expect(requestOf([])).toEqual({ corpus: DEFAULT_CORPUS, mode: "corpus" });
  expect(requestOf(tags("@corpus:journal"))).toEqual({
    corpus: "journal",
    mode: "corpus",
  });
});

test("PIN (own scratch): @scratch: without @share-scratch is still a private copy", () => {
  expect(requestOf(tags("@scratch:good"))).toEqual({
    corpus: "good",
    mode: "own",
  });
});

test("PIN (share): @share-scratch + @scratch: is a feature-shared copy", () => {
  expect(requestOf(tags(SHARE_TAG, "@scratch:good"))).toEqual({
    corpus: "good",
    mode: "share",
  });
});

test("PIN (own-scratch): opts out of a sharing feature, still a private copy", () => {
  expect(requestOf(tags(SHARE_TAG, "@scratch:good", OWN_TAG))).toEqual({
    corpus: "good",
    mode: "own",
  });
});

test("@share-scratch on a @corpus: scenario is ignored, not a second server", () => {
  expect(requestOf(tags(SHARE_TAG, "@corpus:good"))).toEqual({
    corpus: "good",
    mode: "corpus",
  });
});

test("@own-scratch without @share-scratch is refused, not ignored", () => {
  expect(() => requestOf(tags("@scratch:good", OWN_TAG))).toThrow(
    /@own-scratch[\s\S]*@share-scratch/,
  );
});

test("@own-scratch on a @corpus: scenario is refused", () => {
  expect(() => requestOf(tags(SHARE_TAG, "@corpus:good", OWN_TAG))).toThrow(
    /@scratch:good/,
  );
});

test("two corpus tags on one scenario are refused", () => {
  expect(() => requestOf(tags("@scratch:good", "@corpus:chat"))).toThrow(
    /one corpus/,
  );
});

test("spawn fingerprints differ when the server would start differently", () => {
  const base = { stored: false, agent: true, kolu: false };
  expect(spawnFingerprint(base)).toBe(spawnFingerprint({ ...base }));
  expect(spawnFingerprint(base)).not.toBe(
    spawnFingerprint({ ...base, kolu: true }),
  );
  expect(spawnFingerprint(base)).not.toBe(
    spawnFingerprint({ ...base, git: "repo" }),
  );
  expect(spawnFingerprint(base)).not.toBe(
    spawnFingerprint({ ...base, stored: true }),
  );
  expect(spawnFingerprint(base)).not.toBe(
    spawnFingerprint({ ...base, agent: false }),
  );
});

test("filesOf hashes contents, not mtimes, and walks nested paths with /", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-scratch-hash-"));
  try {
    fs.mkdirSync(path.join(root, "notes"));
    fs.writeFileSync(path.join(root, "notes", "first.html"), "<h1>a</h1>\n");
    fs.writeFileSync(path.join(root, "house.olai"), "{}\n");
    const first = filesOf(root);
    expect([...first.keys()].sort()).toEqual(["house.olai", "notes/first.html"]);
    const later = Date.now() + 10_000;
    fs.utimesSync(path.join(root, "house.olai"), later / 1000, later / 1000);
    expect(filesOf(root).get("house.olai")).toBe(first.get("house.olai"));
    fs.writeFileSync(path.join(root, "house.olai"), "{x}\n");
    expect(filesOf(root).get("house.olai")).not.toBe(first.get("house.olai"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("changedFiles sees edits, new files, and deletions", () => {
  const before = new Map([
    ["a.html", "1"],
    ["b.html", "2"],
  ]);
  const after = new Map([
    ["a.html", "1"],
    ["c.html", "3"],
  ]);
  expect(changedFiles(before, after)).toEqual(["b.html", "c.html"]);
});

test("PIN (collision): the error names both scenarios and the file", () => {
  const hit = overlapWith(["notes/first.html", "other.html"], [
    { name: "A relative link opens the page beside it, in olai", files: ["notes/first.html"] },
  ]);
  expect(hit?.writer.name).toContain("relative link");
  expect(hit?.files).toEqual(["notes/first.html"]);
  const error = collisionError(
    "html_previews.feature",
    "A link carrying a fragment opens the page AND lands on the section",
    hit!.writer.name,
    hit!.files,
  );
  expect(error.message).toContain("notes/first.html");
  expect(error.message).toContain("relative link");
  expect(error.message).toContain("fragment");
  expect(error.message).toContain(OWN_TAG);
  expect(error.message).toContain(SHARE_TAG);
});

test("disjoint writers do not overlap", () => {
  expect(
    overlapWith(["chart.html"], [
      { name: "earlier", files: ["atlas.html"] },
    ]),
  ).toBeUndefined();
});

test("PIN (tags): README names the tags the harness honours", () => {
  const readme = fs.readFileSync(
    path.join(import.meta.dirname, "README.md"),
    "utf8",
  );
  expect(readme).toContain(SHARE_TAG);
  expect(readme).toContain(OWN_TAG);
  const src = fs.readFileSync(
    path.join(import.meta.dirname, "support", "scratch.ts"),
    "utf8",
  );
  expect(src).toContain(`SHARE_TAG = "${SHARE_TAG}"`);
  expect(src).toContain(`OWN_TAG = "${OWN_TAG}"`);
});
