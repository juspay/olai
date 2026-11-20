import * as assert from "node:assert";

import { attr, CALENDAR, FILE_DIR, PANE, POLL_TIMEOUT, SIDEBAR } from "./world.ts";
import type { OlaiWorld } from "./world.ts";

interface Moved {
  readonly batch: number;
  readonly attribute: string;
  readonly testid: string | null;
  readonly which: string | null;
  readonly was: string | null;
  readonly now: string | null;
}

export interface Churn {
  readonly moved: ReadonlyArray<Moved>;
  readonly drew: ReadonlyArray<string>;
  readonly took: ReadonlyArray<string>;
  readonly emptied: boolean;
}

const PROBE = "__olaiProbe";

export const markScreen = async (world: OlaiWorld): Promise<void> => {
  await markRegion(world, SIDEBAR, "sidebar");
  await world.page.evaluate(
    ([sidebar, pane, probe]) => {
      const side = document.querySelector(sidebar);
      const main = document.querySelector(pane);
      if (side === null || main === null) {
        throw new Error("the probe was planted before the app drew a sidebar and a pane");
      }
      const moved: Moved[] = [];
      const drew: string[] = [];
      const took: string[] = [];
      let emptied = false;
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
          for (const gone of record.removedNodes) {
            if (!(gone instanceof Element)) continue;
            for (const row of [gone, ...gone.querySelectorAll("[data-node-id]")]) {
              const id = row.getAttribute("data-node-id");
              if (id !== null) took.push(id);
            }
          }
        }
        if (main.querySelector("[data-node-id]") === null) emptied = true;
      }).observe(main, { subtree: true, childList: true });
      (window as unknown as Record<string, unknown>)[probe] = { moved, drew, took, emptied: () => emptied };
    },
    [SIDEBAR, PANE, PROBE] as const,
  );
};

export const screenChurn = async (world: OlaiWorld): Promise<Churn> =>
  await world.page.evaluate((probe) => {
    const held = (window as unknown as Record<string, unknown>)[probe] as
      | { moved: Moved[]; drew: string[]; took: string[]; emptied: () => boolean }
      | undefined;
    if (held === undefined) {
      throw new Error(
        "nothing marked the screen, so there is nothing to say about what " +
          "survived — a step has to mark it before the gesture it is a claim about",
      );
    }
    return { moved: held.moved, drew: held.drew, took: held.took, emptied: held.emptied() };
  }, PROBE);

export const sidebarHeld = async (world: OlaiWorld): Promise<void> => {
  await regionHeld(world, SIDEBAR, "sidebar");
};

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

export const neverDrew = async (world: OlaiWorld, id: string): Promise<void> => {
  const churn = await screenChurn(world);
  assert.ok(
    !churn.drew.includes(id),
    `the pane drew the node "${id}" and took it away again, so the page was ` +
      "on screen un-narrowed before the query it was asked for was answered",
  );
};

export const neverTookAway = async (world: OlaiWorld, id: string): Promise<void> => {
  const churn = await screenChurn(world);
  assert.ok(
    !churn.took.includes(id),
    `the pane took the node "${id}" away and put it back, so the page was ` +
      "narrowed by an answer that was not about the query it had been asked",
  );
};

const REGION = "__olaiRegion";
const SERIAL = "__olaiSerial";

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
      const insideTitle = (element: Element): boolean => {
        const title = element.closest(".olai-md");
        return title !== null && title !== element;
      };
      const ofAPlugin = (element: Element): boolean => element.closest("[data-plugin]") !== null;
      for (const root of roots) {
        serialise(root);
        root.querySelectorAll("*").forEach((element) => {
          if (!insideTitle(element) && !ofAPlugin(element)) serialise(element);
        });
      }
      const slot = { serial, announced: 0 };
      const live = '[role="alert"], [role="status"], [aria-live]';
      const speaking = (node: Node): boolean =>
        node instanceof Element &&
        (node.closest(live) !== null || node.querySelector(live) !== null);
      const watch = new MutationObserver((records) => {
        for (const record of records) {
          const touched = [record.target, ...record.addedNodes];
          if (touched.some(speaking)) slot.announced++;
        }
      });
      for (const root of roots) {
        watch.observe(root, { subtree: true, childList: true, characterData: true });
      }
      (window as unknown as Record<string, unknown>)[region] = slot;
    },
    [selector, what, REGION, SERIAL] as const,
  );
};

const regionChurn = async (
  world: OlaiWorld,
  selector: string,
): Promise<{ marked: number; gone: number; announced: number }> =>
  await world.page.evaluate(
    ([selector, region, key]) => {
      const held = (window as unknown as Record<string, unknown>)[region] as
        | { serial: number; announced: number }
        | undefined;
      if (held === undefined) {
        throw new Error(
          "nothing was marked, so there is nothing to say about what survived " +
            "— a step has to mark it before the gesture it is a claim about",
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
      return { marked: held.serial, gone, announced: held.announced };
    },
    [selector, REGION, SERIAL] as const,
  );

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
      "does that (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/reactivity-after-the-flip.md §2), and it " +
      "costs the reader the caret, the hover and the scroll position it was " +
      "holding.",
  );
};

export const announcedTimes = async (
  world: OlaiWorld,
  selector: string,
  what: string,
  times: number,
): Promise<void> => {
  const churn = await regionChurn(world, selector);
  assert.strictEqual(
    churn.announced,
    times,
    times === 0
      ? `a live region in the ${what} moved ${churn.announced} time(s) without its ` +
        "words changing, so a screen reader read the same sentence out loud " +
        "again for a keystroke that did not change the reader's mind."
      : `a live region in the ${what} was read out loud ${churn.announced} time(s), ` +
        `and the scenario is about it being read ${times}. More than that is ` +
        "one sentence announced again for a frame that did not change it; " +
        "fewer is a line a screen reader was never told about.",
  );
};

export const nothingAnnounced = async (
  world: OlaiWorld,
  selector: string,
  what: string,
): Promise<void> => {
  await announcedTimes(world, selector, what, 0);
};

export const neverEmptied = async (world: OlaiWorld): Promise<void> => {
  const churn = await screenChurn(world);
  assert.ok(
    !churn.emptied,
    "the pane was left holding no rows at all, so a page was pruned by an " +
      "answer that was not about it",
  );
};
