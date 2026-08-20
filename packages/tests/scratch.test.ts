/**
 * Pins on feature-shared scratch: the tag grammar, the restore, the
 * leftover sentence, the restart gate, the retry fallback. Each test is a
 * sabotage target — if `@own-scratch` without `@share-scratch` is silently
 * ignored, if a restore that did not take does not name the files, if a
 * shared scratch can be restarted, the named assertion is what goes red.
 */

import { expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  alreadyShared,
  askResync,
  DEFAULT_CORPUS,
  filesOf,
  leftovers,
  OWN_TAG,
  requestOf,
  RESYNC_PATH,
  restartGate,
  restoreTree,
  sameTree,
  SHARE_TAG,
  unrestoredError,
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
  const error = restartGate({ key: "html_previews.feature::good::off" });
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

test("PIN (hooks): After restores and asks the server to re-read", () => {
  const src = fs.readFileSync(
    path.join(import.meta.dirname, "support", "hooks.ts"),
    "utf8",
  );
  expect(src).toContain("restartGate(");
  expect(src).toContain("alreadyShared(");
  expect(src).toContain("restoreTree(");
  expect(src).toContain("askResync(");
  expect(src).toContain("leftovers(");
  expect(src).toContain("unrestoredError(");
  expect(src).not.toContain("recordWrites(");
});

test("PIN (teardown): the terminal agent drops in-flight fetches on stop", () => {
  const src = fs.readFileSync(
    path.join(import.meta.dirname, "support", "mcp.ts"),
    "utf8",
  );
  expect(src).toContain("AbortController");
  expect(src).toContain("ac.abort()");
  expect(src).not.toContain("stop: () => {}");
});

test("PIN (teardown): AfterAll kills each server's process group before the browser closes", () => {
  const src = fs.readFileSync(
    path.join(import.meta.dirname, "support", "hooks.ts"),
    "utf8",
  );
  expect(src).toContain("detached: true");
  expect(src).toMatch(/process\.kill\(\s*-\s*pid/);
  const afterAll = src.slice(src.indexOf("AfterAll("));
  const killAt = afterAll.indexOf("await killAll()");
  const browserAt = afterAll.indexOf("await browser.close()");
  expect(killAt).toBeGreaterThan(-1);
  expect(browserAt).toBeGreaterThan(-1);
  expect(killAt).toBeLessThan(browserAt);
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

test("PIN (restore): restoreTree puts the fixture back and deletes extras", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "olai-scratch-fix-"));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-scratch-rst-"));
  try {
    fs.mkdirSync(path.join(fixture, "notes"));
    fs.writeFileSync(path.join(fixture, "house.olai"), "{}\n");
    fs.writeFileSync(path.join(fixture, "notes", "a.md"), "a\n");
    fs.writeFileSync(path.join(root, "house.olai"), "{x}\n");
    fs.writeFileSync(path.join(root, "extra.olai"), "nope\n");
    const origin = filesOf(fixture);
    expect(sameTree(filesOf(root), origin)).toBe(false);
    restoreTree(root, fixture);
    expect(sameTree(filesOf(root), origin)).toBe(true);
    expect(leftovers(origin, root)).toEqual([]);
    expect(fs.existsSync(path.join(root, "extra.olai"))).toBe(false);
    expect(fs.readFileSync(path.join(root, "house.olai"), "utf8")).toBe("{}\n");
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("PIN (baseline): leftovers names the files restore did not put back", () => {
  const originRoot = fs.mkdtempSync(path.join(os.tmpdir(), "olai-scratch-org-"));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-scratch-left-"));
  try {
    fs.writeFileSync(path.join(originRoot, "house.olai"), "{}\n");
    fs.writeFileSync(path.join(root, "house.olai"), "{x}\n");
    fs.writeFileSync(path.join(root, "extra.olai"), "nope\n");
    const origin = filesOf(originRoot);
    expect(leftovers(origin, root)).toEqual(["extra.olai", "house.olai"]);
    const error = unrestoredError(
      "keyboard_editing.feature",
      "Typing a title writes it, and the page follows the file",
      leftovers(origin, root),
    );
    expect(error.message).toContain("house.olai");
    expect(error.message).toContain("extra.olai");
    expect(error.message).toContain("Typing a title");
    expect(error.message).toContain(OWN_TAG);
    expect(error.message).toContain(SHARE_TAG);
  } finally {
    fs.rmSync(originRoot, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("PIN (resync path): the harness and the server name the same door", () => {
  const server = fs.readFileSync(
    path.join(
      import.meta.dirname,
      "..",
      "server",
      "src",
      "resync.ts",
    ),
    "utf8",
  );
  expect(server).toContain(`RESYNC_PATH = "${RESYNC_PATH}"`);
  expect(askResync.name).toBe("askResync");
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
  expect(src).toContain(`RESYNC_PATH = "${RESYNC_PATH}"`);
});
