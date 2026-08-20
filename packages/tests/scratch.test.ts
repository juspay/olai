/**
 * Pins on feature-shared scratch: the tag grammar, the hash-diff, the
 * collision sentence, the restart gate, the retry fallback. Each test is a
 * sabotage target — if `@own-scratch` without `@share-scratch` is silently
 * ignored, if two writers of the same file do not name each other, if a
 * shared scratch can be restarted, the named assertion is what goes red.
 */

import { expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  alreadyShared,
  DEFAULT_CORPUS,
  filesOf,
  OWN_TAG,
  recordWrites,
  requestOf,
  restartGate,
  SHARE_TAG,
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

test("PIN (restart): a shared scratch may not be restarted", () => {
  expect(restartGate(undefined)).toBeUndefined();
  const error = restartGate({ key: "html_previews.feature::good::off", was: new Map() });
  expect(error).toBeDefined();
  expect(error!.message).toContain(OWN_TAG);
  expect(error!.message).toContain(SHARE_TAG);
  expect(error!.message).toMatch(/restarts the server/);
});

test("PIN (retry): a pickle already on the shared slot takes a private copy", () => {
  const seen = new Set(["pickle-1"]);
  expect(alreadyShared(seen, "pickle-1")).toBe(true);
  expect(alreadyShared(seen, "pickle-2")).toBe(false);
  expect(alreadyShared(new Set(), "pickle-1")).toBe(false);
});

test("PIN (hooks): stopOwnServer and the share path consult the gates", () => {
  const src = fs.readFileSync(
    path.join(import.meta.dirname, "support", "hooks.ts"),
    "utf8",
  );
  expect(src).toContain("restartGate(");
  expect(src).toContain("alreadyShared(");
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

test("PIN (collision): recordWrites names both scenarios and the file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-scratch-collide-"));
  try {
    const file = path.join(root, "notes-first.html");
    fs.writeFileSync(file, "a\n");
    const beforeFirst = filesOf(root);
    fs.writeFileSync(file, "b\n");
    const first = recordWrites({
      feature: "html_previews.feature",
      name: "A relative link opens the page beside it, in olai",
      before: beforeFirst,
      root,
      writers: [],
    });
    expect(first.error).toBeUndefined();
    expect(first.writers[0]?.files).toEqual(["notes-first.html"]);
    const beforeSecond = filesOf(root);
    fs.writeFileSync(file, "c\n");
    const second = recordWrites({
      feature: "html_previews.feature",
      name: "A link carrying a fragment opens the page AND lands on the section",
      before: beforeSecond,
      root,
      writers: first.writers,
    });
    expect(second.error).toBeDefined();
    expect(second.error!.message).toContain("notes-first.html");
    expect(second.error!.message).toContain("relative link");
    expect(second.error!.message).toContain("fragment");
    expect(second.error!.message).toContain(OWN_TAG);
    expect(second.error!.message).toContain(SHARE_TAG);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("disjoint writers do not overlap", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-scratch-disjoint-"));
  try {
    const beforeFirst = filesOf(root);
    fs.writeFileSync(path.join(root, "atlas.html"), "a\n");
    const first = recordWrites({
      feature: "html_previews.feature",
      name: "earlier",
      before: beforeFirst,
      root,
      writers: [],
    });
    expect(first.error).toBeUndefined();
    const beforeSecond = filesOf(root);
    fs.writeFileSync(path.join(root, "chart.html"), "c\n");
    const second = recordWrites({
      feature: "html_previews.feature",
      name: "later",
      before: beforeSecond,
      root,
      writers: first.writers,
    });
    expect(second.error).toBeUndefined();
    expect(second.writers.map((w) => w.files)).toEqual([
      ["atlas.html"],
      ["chart.html"],
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
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
