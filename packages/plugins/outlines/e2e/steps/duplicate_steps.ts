import * as assert from "node:assert";
import { Then } from "@olai/tests/harness/runner.ts";

import type { OlaiWorld } from "@olai/tests/harness/world.ts";

type Record_ = Record<string, unknown>;

const DIFFERS = new Set([
  "id",
  "parent",
  "ord",
  "created",
  "changed",
  "after",
  "blocks",
  "see",
  "mirror",
]);

const nodesIn = (world: OlaiWorld, file: string): ReadonlyArray<Record_> =>
  world.servedNodesSoFar(file) as ReadonlyArray<Record_>;

interface Placed {
  readonly node: Record_;
  readonly line: number;
}

const placedIn = (world: OlaiWorld, file: string): ReadonlyArray<Placed> =>
  nodesIn(world, file).map((node, line) => ({ node, line }));

const childrenOf = (
  rows: ReadonlyArray<Placed>,
  parent: unknown,
): ReadonlyArray<Record_> =>
  rows
    .filter(({ node }) => node["parent"] === parent)
    .sort((a, b) =>
      a.node["ord"] === b.node["ord"]
        ? a.line - b.line
        : String(a.node["ord"]) < String(b.node["ord"])
        ? -1
        : 1
    )
    .map(({ node }) => node);

const named = (rows: ReadonlyArray<Placed>, id: string): Record_ => {
  const found = rows.find(({ node }) => node["id"] === id);
  if (found === undefined) throw new Error(`no record \`${id}\` in the outline`);
  return found.node;
};

const paired = (
  world: OlaiWorld,
  file: string,
  id: string,
): ReadonlyArray<readonly [Record_, Record_]> | undefined => {
  const rows = placedIn(world, file);
  const original = named(rows, id);
  const row = childrenOf(rows, original["parent"]);
  const at = row.findIndex((node) => node["id"] === id);
  const copy = row[at + 1];
  if (copy === undefined || copy["title"] !== original["title"]) return undefined;

  const pairs: Array<readonly [Record_, Record_]> = [];
  const walk = (left: Record_, right: Record_): void => {
    pairs.push([left, right]);
    const mine = childrenOf(rows, left["id"]);
    const theirs = childrenOf(rows, right["id"]);
    if (mine.length !== theirs.length) {
      throw new Error(
        `\`${String(left["id"])}\` has ${mine.length} children and the copy below ` +
          `it, \`${String(right["id"])}\`, has ${theirs.length}`,
      );
    }
    mine.forEach((child, index) => walk(child, theirs[index] as Record_));
  };
  walk(original, copy);
  return pairs;
};

const waitForCopy = async (
  world: OlaiWorld,
  file: string,
  id: string,
): Promise<ReadonlyArray<readonly [Record_, Record_]>> => {
  await world.waitUntil(
    async () => paired(world, file, id) !== undefined,
    `${file} to hold a copy of ${JSON.stringify(id)} below it`,
  );
  const pairs = paired(world, file, id);
  if (pairs === undefined) {
    throw new Error(`${file} held a copy of ${JSON.stringify(id)} and then did not`);
  }
  return pairs;
};

Then(
  "{string} holds a copy of {string} with fresh ids throughout",
  async function (this: OlaiWorld, file: string, id: string) {
    const pairs = await waitForCopy(this, file, id);
    for (const [was, copy] of pairs) {
      assert.notStrictEqual(
        copy["id"],
        was["id"],
        `the copy of \`${String(was["id"])}\` carries its id`,
      );
    }
    const both = pairs.flatMap(([was, copy]) => [String(was["id"]), String(copy["id"])]);
    assert.strictEqual(
      new Set(both).size,
      both.length,
      `the original and its copy share an id: ${both.join(", ")}`,
    );
    const ids = nodesIn(this, file).map((node) => String(node["id"]));
    assert.strictEqual(
      new Set(ids).size,
      ids.length,
      `${file} claims an id twice: ${ids.join(", ")}`,
    );
  },
);

Then(
  "the copy of {string} in {string} repeats every field but the ids and the stamps",
  async function (this: OlaiWorld, id: string, file: string) {
    const pairs = await waitForCopy(this, file, id);
    for (const [was, copy] of pairs) {
      const left = Object.fromEntries(
        Object.entries(was).filter(([key]) => !DIFFERS.has(key)),
      );
      const right = Object.fromEntries(
        Object.entries(copy).filter(([key]) => !DIFFERS.has(key)),
      );
      assert.deepStrictEqual(
        right,
        left,
        `the copy of \`${String(was["id"])}\` does not say what it says`,
      );
      if (copy["mirror"] !== undefined) continue;
      assert.ok(
        typeof copy["created"] === "string" && copy["created"] !== was["created"],
        `the copy of \`${String(was["id"])}\` should carry a \`created\` of its own`,
      );
      assert.strictEqual(
        copy["changed"],
        undefined,
        `the copy of \`${String(was["id"])}\` should carry no \`changed\``,
      );
    }
  },
);

const pairFor = (
  pairs: ReadonlyArray<readonly [Record_, Record_]>,
  id: string,
): readonly [Record_, Record_] => {
  const found = pairs.find(([was]) => was["id"] === id);
  if (found === undefined) {
    throw new Error(`\`${id}\` is not in the subtree that was copied`);
  }
  return found;
};

Then(
  "in the copy of {string} in {string}, {string} waits on the copy of {string} and on {string}",
  async function (
    this: OlaiWorld,
    root: string,
    file: string,
    id: string,
    inside: string,
    outside: string,
  ) {
    const pairs = await waitForCopy(this, file, root);
    const [, copy] = pairFor(pairs, id);
    const [, copiedTarget] = pairFor(pairs, inside);
    assert.deepStrictEqual(copy["after"], [copiedTarget["id"], outside]);
  },
);

Then(
  "the copy of {string} in {string} places a mirror of {string}",
  async function (this: OlaiWorld, id: string, file: string, target: string) {
    const pairs = await waitForCopy(this, file, id);
    const placements = pairs
      .map(([, copy]) => copy)
      .filter((copy) => copy["mirror"] !== undefined);
    assert.deepStrictEqual(
      placements.map((copy) => copy["mirror"]),
      [target],
      `the copy should place exactly one mirror, of \`${target}\``,
    );
    assert.deepStrictEqual(
      Object.keys(placements[0] as Record_).sort(),
      ["id", "mirror", "ord", "parent"],
    );
  },
);
