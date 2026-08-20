/**
 * WHAT SURVIVED A NAVIGATION — the DOM-identity probe, as a step file can ask
 * it.
 *
 * A page that re-renders correctly and a page that is torn down and built again
 * draw the SAME markup: every assertion this suite has could pass over either,
 * because they all read the DOM after it settled. What tells them apart is
 * IDENTITY — whether the element the reader was looking at is the element that
 * is on screen now — and the only way to ask that is to mark the elements
 * before the gesture and count the marks after it.
 *
 * So this is two things planted together and read once:
 *
 *   - a SERIAL on every element under a region, and the count of how many of
 *     them are gone afterwards. Zero is "nothing remounted"; a number is a
 *     subtree that was rebuilt, whatever it looks like now;
 *   - a `MutationObserver` over that region and over the pane, keeping every
 *     attribute change and every row added, each stamped with the BATCH it
 *     arrived in. A batch is one delivery of the observer's queue, which is one
 *     of the browser's own microtask drains — so "these two changes are the
 *     same frame" is a question this can answer, and it is the difference
 *     between a mark that MOVED from one entry to another and a mark that went
 *     out and came back a round trip later.
 *
 * It is `docs/brainstorming/reactivity-after-the-flip.md` §6's own script,
 * moved here the first time a PR of that campaign needed it (PR 1), so the ones
 * after it assert on the same reading rather than each writing their own.
 *
 * EVERYTHING IS PLANTED IN THE PAGE, in one `evaluate` per region: the marks
 * have to be on the elements before the gesture, and the observer has to be
 * watching while it happens. Nothing here polls, and nothing here waits — the
 * scenario's own steps do that, exactly as they always have.
 *
 * ## Two plants, because there are two questions
 *
 * {@link markScreen} is the NAVIGATION probe, and it is fixed: the sidebar and
 * the pane, because "what did clicking a link do to the chrome beside the page"
 * is one question with two halves and a step that had to remember to ask for
 * both is a step that will one day ask for one.
 *
 * {@link markRegion} is the same reading asked of ANY region, for the lists
 * that are rebuilt by something other than a navigation (PR 2 of the same
 * campaign: every list drawn over a wire array, on every frame of its page or
 * every answer it draws). It watches for one more thing, which the navigation
 * probe has no use for: whether a `role="alert"` under the region MOVED — a
 * live region rebuilt with the same words in it is a sentence read out loud a
 * second time, and that is a fact about mutations rather than about what is on
 * screen at the end.
 *
 * They keep separate slots and separate serials, so a scenario may plant both
 * and neither reads the other's marks.
 */

import * as assert from "node:assert";

import { attr, CALENDAR, FILE_DIR, PANE, POLL_TIMEOUT, SIDEBAR } from "./world.ts";
import type { OlaiWorld } from "./world.ts";

/** One attribute change under a watched region. */
interface Moved {
  /** Which delivery of the observer's queue carried it — see the header. */
  readonly batch: number;
  readonly attribute: string;
  /** What the element it happened to says it is: its `data-testid`, and the
   *  `data-path` / `href` that says WHICH one. */
  readonly testid: string | null;
  readonly which: string | null;
  readonly was: string | null;
  readonly now: string | null;
}

/** What the probe saw. */
export interface Churn {
  /** How many elements were marked, and how many of those are gone. */
  readonly marked: number;
  readonly gone: number;
  readonly moved: ReadonlyArray<Moved>;
  /** Every node id that was ADDED to the pane while the probe was watching —
   *  what the page drew, as against what it is drawing now. */
  readonly drew: ReadonlyArray<string>;
}

/** Where the probe keeps its own state. A name nothing else on `window` could
 *  be, for `NO_RELOAD_MARK`'s reason: a page load wipes it, which is honest —
 *  a probe that survived a reload would be measuring two documents. */
const PROBE = "__olaiProbe";

/**
 * Mark the sidebar and start watching — the whole of the plant.
 *
 * The PANE is watched too, and by the same call, because the two questions a
 * navigation raises are one gesture's: what happened to the chrome beside the
 * page, and what the page itself drew on the way in. A step that had to
 * remember to ask for both is a step that will one day ask for one.
 */
export const markScreen = async (world: OlaiWorld): Promise<void> => {
  await world.page.evaluate(
    ([sidebar, pane, probe]) => {
      const side = document.querySelector(sidebar);
      const main = document.querySelector(pane);
      if (side === null || main === null) {
        throw new Error("the probe was planted before the app drew a sidebar and a pane");
      }
      let serial = 0;
      side.querySelectorAll("*").forEach((el) => {
        (el as unknown as Record<string, unknown>).__olaiSerial = ++serial;
      });
      const moved: unknown[] = [];
      const drew: string[] = [];
      let batch = 0;
      new MutationObserver((records) => {
        batch++;
        for (const record of records) {
          if (record.type !== "attributes" || record.attributeName === null) continue;
          const target = record.target as Element;
          moved.push({
            batch,
            attribute: record.attributeName,
            testid: target.getAttribute("data-testid"),
            which: target.getAttribute("data-path") ?? target.getAttribute("href"),
            was: record.oldValue,
            now: target.getAttribute(record.attributeName),
          });
        }
      }).observe(side, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeOldValue: true,
      });
      new MutationObserver((records) => {
        for (const record of records) {
          for (const added of record.addedNodes) {
            if (!(added instanceof Element)) continue;
            for (const row of [added, ...added.querySelectorAll("[data-node-id]")]) {
              const id = row.getAttribute("data-node-id");
              if (id !== null) drew.push(id);
            }
          }
        }
      }).observe(main, { subtree: true, childList: true });
      (window as unknown as Record<string, unknown>)[probe] = { serial, moved, drew };
    },
    [SIDEBAR, PANE, PROBE] as const,
  );
};

/** What it saw — asked once, so a scenario making three claims about one
 *  gesture is making them about one reading of it. */
export const screenChurn = async (world: OlaiWorld): Promise<Churn> =>
  await world.page.evaluate(
    ([sidebar, probe]) => {
      const held = (window as unknown as Record<string, unknown>)[probe] as
        | { serial: number; moved: unknown[]; drew: string[] }
        | undefined;
      if (held === undefined) {
        throw new Error(
          "nothing marked the screen, so there is nothing to say about what " +
            "survived — a step has to mark it before the gesture it is a claim about",
        );
      }
      const still = new Set<number>();
      document.querySelector(sidebar)?.querySelectorAll("*").forEach((el) => {
        const serial = (el as unknown as Record<string, unknown>).__olaiSerial;
        if (typeof serial === "number") still.add(serial);
      });
      let gone = 0;
      for (let i = 1; i <= held.serial; i++) if (!still.has(i)) gone++;
      return {
        marked: held.serial,
        gone,
        moved: held.moved,
        drew: held.drew,
      } as unknown as Churn;
    },
    [SIDEBAR, PROBE] as const,
  );

/** The sidebar is the same sidebar: every element that was under it is still
 *  under it. */
export const sidebarHeld = async (world: OlaiWorld): Promise<void> => {
  const churn = await screenChurn(world);
  assert.ok(
    churn.marked > 0,
    "nothing was marked under the sidebar, so surviving proves nothing",
  );
  assert.strictEqual(
    churn.gone,
    0,
    `${churn.gone} of the ${churn.marked} elements under the sidebar were ` +
      "destroyed and drawn again, so the column folded and relit under the " +
      "reader instead of holding still",
  );
};

/** A folder of the tree never closed. The FOLD, not the elements: a folder that
 *  collapsed and re-opened may have kept its `<li>` and still put its contents
 *  away in front of somebody. */
export const folderHeld = async (world: OlaiWorld, path: string): Promise<void> => {
  const churn = await screenChurn(world);
  const shut = churn.moved.filter((one) =>
    one.attribute === "data-collapsed" && one.which === path && one.now === "true"
  );
  assert.deepStrictEqual(
    shut,
    [],
    `the folder "${path}" was folded while the page was opened, and a folder ` +
      "that closes and re-opens is the tree rebuilding itself",
  );
  await world.page
    .locator(`${FILE_DIR}${attr("data-path", path)}${attr("data-collapsed", "false")}`)
    .waitFor({ state: "attached", timeout: POLL_TIMEOUT });
};

/** The current mark went from one entry to the other WITHOUT a beat in between
 *  — one batch of the observer's queue holds both halves of the move. */
export const currentMoved = async (world: OlaiWorld): Promise<void> => {
  const churn = await screenChurn(world);
  const marks = churn.moved.filter((one) => one.attribute === "aria-current");
  assert.ok(
    marks.length >= 2,
    `the current mark did not move: ${JSON.stringify(marks)}`,
  );
  const left = marks.find((one) => one.now === null);
  const arrived = marks.find((one) => one.now === "page");
  assert.ok(
    left !== undefined && arrived !== undefined,
    `the current mark did not both leave one entry and reach another: ${
      JSON.stringify(marks)
    }`,
  );
  assert.strictEqual(
    left.batch,
    arrived.batch,
    "the current mark left one entry and reached the other in two different " +
      "frames, so the column had no page marked in between",
  );
};

/** The month on screen never changed — the grid a reader is standing in stays
 *  where they left it. */
export const monthHeld = async (world: OlaiWorld, month: string): Promise<void> => {
  const churn = await screenChurn(world);
  assert.deepStrictEqual(
    churn.moved.filter((one) => one.attribute === "data-month"),
    [],
    `the calendar changed month on the way past, and it is showing ${month}`,
  );
  await world.page
    .locator(`${CALENDAR}${attr("data-month", month)}`)
    .waitFor({ state: "attached", timeout: POLL_TIMEOUT });
};

/** A node the page never drew — not "is not drawn now", which a page that drew
 *  it and took it away again would also pass. */
export const neverDrew = async (world: OlaiWorld, id: string): Promise<void> => {
  const churn = await screenChurn(world);
  assert.ok(
    !churn.drew.includes(id),
    `the pane drew the node "${id}" and took it away again, so the page was ` +
      "on screen un-narrowed before the query it was asked for was answered",
  );
};

// ── the region probe ───────────────────────────────────────────────────

/** Where the region probe keeps its own state and its own serials, apart from
 *  the screen probe's above — see the header. */
const REGION = "__olaiRegion";
const REGION_SERIAL = "__olaiRegionSerial";

/**
 * Serial every element of a region, and watch it for announcements.
 *
 * Several roots are allowed and all of them are marked: what a scenario names
 * is a KIND of thing on screen (`redraw_steps.ts` holds the table), and a page
 * can be drawing two of them.
 */
export const markRegion = async (
  world: OlaiWorld,
  selector: string,
  what: string,
): Promise<void> => {
  await world.page.evaluate(
    ([selector, what, region, key]) => {
      const roots = [...document.querySelectorAll(selector)];
      if (roots.length === 0) {
        throw new Error(`the ${what} is not on screen, so marking it proves nothing`);
      }
      let serial = 0;
      const serialise = (element: Element) => {
        (element as unknown as Record<string, unknown>)[key] = ++serial;
      };
      for (const root of roots) {
        serialise(root);
        root.querySelectorAll("*").forEach(serialise);
      }
      // What a screen reader would be told AGAIN: a mutation that touched an
      // alerting element, whether it was the element itself, one added or one
      // taken away.
      const announced: Array<string> = [];
      const alarming = (node: Node): boolean =>
        node instanceof Element &&
        (node.getAttribute("role") === "alert" ||
          node.closest('[role="alert"]') !== null ||
          node.querySelector('[role="alert"]') !== null);
      for (const root of roots) {
        new MutationObserver((records) => {
          for (const record of records) {
            const touched = [
              record.target,
              ...record.addedNodes,
              ...record.removedNodes,
            ];
            if (touched.some(alarming)) announced.push(record.type);
          }
        }).observe(root, { subtree: true, childList: true, characterData: true });
      }
      (window as unknown as Record<string, unknown>)[region] = { serial, announced };
    },
    [selector, what, REGION, REGION_SERIAL] as const,
  );
};

/** What the region probe saw — read afresh per claim, like the screen's. */
const regionChurn = async (
  world: OlaiWorld,
  selector: string,
): Promise<{ marked: number; gone: number; announced: number }> =>
  await world.page.evaluate(
    ([selector, region, key]) => {
      const held = (window as unknown as Record<string, unknown>)[region] as
        | { serial: number; announced: ReadonlyArray<string> }
        | undefined;
      if (held === undefined) {
        throw new Error(
          "nothing marked a region, so there is nothing to say about what " +
            "survived — a step has to mark it before the gesture it is a claim about",
        );
      }
      const still = new Set<number>();
      for (const root of document.querySelectorAll(selector)) {
        const own = (root as unknown as Record<string, unknown>)[key];
        if (typeof own === "number") still.add(own);
        root.querySelectorAll("*").forEach((element) => {
          const serial = (element as unknown as Record<string, unknown>)[key];
          if (typeof serial === "number") still.add(serial);
        });
      }
      let gone = 0;
      for (let i = 1; i <= held.serial; i++) if (!still.has(i)) gone++;
      return { marked: held.serial, gone, announced: held.announced.length };
    },
    [selector, REGION, REGION_SERIAL] as const,
  );

/** The region is the same region: every element that was under it is still
 *  under it. */
export const regionHeld = async (
  world: OlaiWorld,
  selector: string,
  what: string,
): Promise<void> => {
  const churn = await regionChurn(world, selector);
  assert.strictEqual(
    churn.gone,
    0,
    `${churn.gone} of the ${churn.marked} elements of the ${what} were torn ` +
      "down and drawn again for a frame that did not change what they say. A " +
      "list keyed by REFERENCE over an array the store rebuilds every frame " +
      "does that (docs/brainstorming/reactivity-after-the-flip.md §2), and it " +
      "costs the reader the caret, the hover and the scroll position it was " +
      "holding.",
  );
};

/** ...and nothing under it was read out loud a second time. */
export const nothingAnnounced = async (
  world: OlaiWorld,
  selector: string,
  what: string,
): Promise<void> => {
  const churn = await regionChurn(world, selector);
  assert.strictEqual(
    churn.announced,
    0,
    `a live region in the ${what} moved ${churn.announced} time(s) without its ` +
      "words changing, so a screen reader read the same sentence out loud again " +
      "for a keystroke that did not change the reader's mind.",
  );
};
