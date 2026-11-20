import * as assert from "node:assert";
import type { Locator, Page } from "playwright";

import { HYDRATION_TIMEOUT } from "./world.ts";
import type { OlaiWorld } from "./world.ts";

export const WAITING = '[data-markdown="waiting"]';

export const PAINTS = "__olaiMarkdownPaints";

export const ILLEGIBLE_PX = 2;

export interface WaitingPaint {
  readonly what: string;
  readonly legible: boolean;
  readonly filter: string;
  readonly text: string;
}

export const recordPaints = (
  asked: { key: string; illegiblePx: number; waiting: string },
): void => {
  const held = (): WaitingPaint[] => {
    const said = sessionStorage.getItem(asked.key);
    return said === null ? [] : (JSON.parse(said) as WaitingPaint[]);
  };
  if (sessionStorage.getItem(asked.key) === null) {
    sessionStorage.setItem(asked.key, "[]");
  }
  const keep = (paint: WaitingPaint): void => {
    sessionStorage.setItem(asked.key, JSON.stringify([...held(), paint]));
  };

  const blurOf = (filter: string): number => {
    const blur = /blur\(([\d.]+)px\)/.exec(filter);
    return blur === null ? 0 : Number(blur[1]);
  };

  const look = (element: Element): void => {
    const filter = getComputedStyle(element).filter;
    keep({
      what: element.getAttribute("data-testid") ?? element.tagName.toLowerCase(),
      legible: blurOf(filter) < asked.illegiblePx,
      filter,
      text: (element.textContent ?? "").trim().slice(0, 120),
    });
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        if ((record.target as Element).matches(asked.waiting)) look(record.target as Element);
        continue;
      }
      for (const added of record.addedNodes) {
        if (!(added instanceof Element)) continue;
        if (added.matches(asked.waiting)) look(added);
        for (const inside of added.querySelectorAll(asked.waiting)) look(inside);
      }
    }
  });
  // THE DOCUMENT, not `document.documentElement`: this runs before the shell
  // has been parsed, where there is no root element yet and observing one is a
  // throw.
  observer.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-markdown"],
  });
};

export const waitsIllegibly = async (
  world: OlaiWorld,
  target: Locator,
  what: string,
): Promise<void> => {
  await target.first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const filter = await target.first().evaluate((el) => getComputedStyle(el).filter);
  const blur = /blur\(([\d.]+)px\)/.exec(filter);
  assert.ok(
    blur !== null && Number(blur[1]) >= ILLEGIBLE_PX,
    `${what} is holding its markdown source where somebody could read it — ` +
      `the filter in force is ${JSON.stringify(filter)}`,
  );
};

export const stopsWaiting = async (
  world: OlaiWorld,
  target: Locator,
  what: string,
): Promise<void> => {
  await world.waitUntil(
    async () => (await target.count()) === 0,
    `${what} to stop waiting on the renderer`,
  );
};

export const paintsOn = (page: Page): Promise<ReadonlyArray<WaitingPaint> | undefined> =>
  page.evaluate<ReadonlyArray<WaitingPaint> | undefined, string>((key) => {
    const said = sessionStorage.getItem(key);
    return said === null ? undefined : (JSON.parse(said) as WaitingPaint[]);
  }, PAINTS);
