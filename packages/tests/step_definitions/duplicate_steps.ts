/**
 * The copy, read off the disk.
 *
 * Its own file for the reason the trash's steps are: what a duplicate claims
 * is not "a row appeared" but "the file now holds a second subtree that says
 * everything the first one says and shares no id with it" — and that is a
 * claim about RECORDS, which the tree's steps have no way to make. The page is
 * still asserted, by the tree's own steps, in the scenarios that press a key;
 * these are the half a screenshot cannot show.
 *
 * NOTHING HERE NAMES THE COPY'S IDS, and it cannot: they are minted by the
 * write, so a step that spelled one would be a step that only passes against a
 * fixed `mint`. The copy is found by its PLACE instead — the sibling
 * immediately below the node that was duplicated — and its descendants are
 * paired with the original's by walking both subtrees in sibling order. That
 * pairing is what every assertion below is written against, so an op that
 * copied the right fields into the wrong shape fails here rather than passing
 * on a field-by-field spot check.
 */

import * as assert from "node:assert";
import { Then } from "@cucumber/cucumber";

import type { OlaiWorld } from "../support/world.ts";

type Record_ = Record<string, unknown>;

/** The fields a copy is ENTITLED to differ in — everything else is compared
 *  verbatim, which is what makes the field-for-field step below a claim about the
 *  whole record rather than about the fields somebody remembered to list.
 *
 *  `parent` and `ord` are placement, `id` is identity, the two stamps are the
 *  ledger's, and the four reference fields have their own steps because their
 *  answer depends on whether the target was inside the subtree. */
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

/** A record with the line it sits on — what {@link childrenOf} sorts, built
 *  once per read rather than per row of children. */
interface Placed {
  readonly node: Record_;
  readonly line: number;
}

const placedIn = (world: OlaiWorld, file: string): ReadonlyArray<Placed> =>
  nodesIn(world, file).map((node, line) => ({ node, line }));

/**
 * One row of children, in the order the outline reads them — the format's own
 * `byOrd` rule, spelled WHOLE: `ord` is a fractional index over base62, so
 * plain string comparison is the sort, and FILE ORDER breaks a tie rather than
 * the engine's sort stability.
 *
 * Spelled rather than imported, and that is this package's rule rather than an
 * oversight: `@olai/format` is here for NAMES and no behaviour (package.json
 * says so at length), because these tests drive the client through a browser
 * and not through its modules. What that costs is exactly this — a second
 * spelling of sibling order — so it is spelled in FULL. The tie-break is the
 * half a shorter version drops, and `byOrd`'s own comment is why it is here:
 * that function breaks ties rather than leaving them to the engine, and a
 * comparator that quietly relied on `Array.sort` being stable would be reading
 * the same file a different way from the app under test.
 */
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

/**
 * The original's records paired with the copy's, in sibling order — or
 * `undefined` while the copy is not on disk yet.
 *
 * TWO OUTCOMES THAT ARE NOT THE SAME THING, and keeping them apart is the whole
 * shape of this function. "The write has not landed" is what every step below
 * WAITS on; "the two subtrees do not line up" is a defect, and a defect that
 * came back as `undefined` would be polled at for the full timeout and then
 * reported as a write that never arrived. So the second one THROWS, naming both
 * sides — the suite's rule that an error is never silently swallowed, read into
 * a harness.
 *
 * The copy's ROOT is the sibling immediately below the original, which is where
 * the op puts it and the only thing about the copy this harness may assume.
 * Everything under it is paired positionally.
 */
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
  // Not there YET: the write is a round trip, and the row below the original is
  // where it will appear.
  if (copy === undefined) return undefined;

  const pairs: Array<readonly [Record_, Record_]> = [];
  const walk = (left: Record_, right: Record_): void => {
    pairs.push([left, right]);
    const mine = childrenOf(rows, left["id"]);
    const theirs = childrenOf(rows, right["id"]);
    // A defect rather than a wait: the write is all-or-none, so a copy that is
    // on disk is on disk whole.
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
  // Read again rather than kept from inside the poll, and checked rather than
  // asserted: another writer could take the copy away between the two, and a
  // harness that said so beats one that reported the next assertion instead.
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
    // THE GUARANTEE, stated over the whole file rather than over the pairs: no
    // id in the outline is claimed twice. A copy that reused one would resolve
    // every reference to whichever record the derivation kept.
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
      // Born NOW, and written to by nobody since — the two the ledger owns.
      // A PLACEMENT carries neither, and carries nothing else either: a mirror
      // record is `{id, parent, ord, mirror}`, so a stamp on one would be a
      // field the format does not give it.
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

/** The pair one id names, for the reference steps: the record it was, and the
 *  record it became. */
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

/**
 * THE EDGE RULE, both halves in one assertion — which is the only way to state
 * it, because both halves live on one record: `pick the hinges` waits on a
 * sibling INSIDE the subtree being copied and on a node OUTSIDE it.
 *
 * It names the root that was duplicated AND the row inside it, because those
 * are two different ids and the pairing is built from the root. The inside
 * target is named through the pairing (its copy's id was minted by the write
 * and nothing here may spell one); the outside target is named LITERALLY,
 * because keeping the target it always had is the whole claim.
 */
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
    // A PLACEMENT and nothing else: the four fields a mirror record may carry,
    // which is what "the placement, not the identity" means on disk.
    assert.deepStrictEqual(
      Object.keys(placements[0] as Record_).sort(),
      ["id", "mirror", "ord", "parent"],
    );
  },
);
