import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import {
  APP_HEADER,
  HEALTH,
  HEADINGS,
  POLL_TIMEOUT,
  PREFS_TRIGGER,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const EDGE = 1;

const rowLineOf = (id: string): string => `[data-row-key$="/${id}"]`;

Then("the app header is at the top of the viewport", async function (this: OlaiWorld) {
  const header = await this.box(this.page.locator(APP_HEADER), "the app header");
  assert.ok(
    header.y >= -EDGE && header.y <= EDGE,
    `the header's top edge is at y=${Math.round(header.y)} — in flow it goes ` +
      "negative by however far the page has scrolled, which is the bug this " +
      "scenario is about",
  );
  assert.ok(
    header.height > 0,
    "the header has no height, so being at the top of the viewport means nothing",
  );
});

Then(
  "the header chrome takes the pointer where the page runs under it",
  async function (this: OlaiWorld) {
    for (const [selector, name] of [
      [HEALTH, "health"],
      [PREFS_TRIGGER, "prefs-trigger"],
    ] as const) {
      const found = await this.topmostTestidOver(this.page.locator(selector), name);
      assert.strictEqual(
        found,
        name,
        `the element at the middle of ${name} is ${found} — something on the ` +
          "page is painting over the header",
      );
    }
  },
);

When(
  "a jump lands the row {string} at the top of the window",
  async function (this: OlaiWorld, id: string) {
    const row = this.page.locator(rowLineOf(id));
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const before = await this.page.evaluate(() => scrollY);
    await row.evaluate((el) => {
      el.scrollIntoView({ block: "start" });
    });
    await this.waitUntil(async () => (await this.page.evaluate(() => scrollY)) > before,
      `the window to move after jumping to the row ${JSON.stringify(id)}`);
  },
);

Then(
  "the row {string} is clear of the pinned section {string}",
  async function (this: OlaiWorld, id: string, sectionId: string) {
    const row = this.page.locator(rowLineOf(id));
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const section = this.page.locator(rowLineOf(sectionId));
    await section.waitFor({ state: "visible", timeout: POLL_TIMEOUT });

    const landed = await this.page.evaluate(
      ({ rowSel, sectionSel }) => {
        const rowEl = document.querySelector(rowSel);
        const sectionEl = document.querySelector(sectionSel);
        if (!rowEl || !sectionEl) return null;
        const rect = (el: Element) => {
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom };
        };
        const r = rowEl.getBoundingClientRect();
        const hit = document.elementFromPoint((r.left + r.right) / 2, r.top + 2);
        return {
          row: rect(rowEl),
          section: rect(sectionEl),
          sectionPosition: getComputedStyle(sectionEl).position,
          moved: scrollY > 0,
                hitKey: hit?.closest("[data-row-key]")?.getAttribute("data-row-key") ?? null,
        hitRowId: hit?.closest("[data-row-key]")?.getAttribute("data-row-key")?.split("/").pop() ?? null,
        };
      },
      { rowSel: rowLineOf(id), sectionSel: rowLineOf(sectionId) },
    );
    assert.ok(landed, `rows ${JSON.stringify(id)} / ${JSON.stringify(sectionId)} are not both drawn`);
    assert.ok(landed.moved, "the jump changed nothing — the page did not move");
    assert.strictEqual(
      landed.sectionPosition,
      "sticky",
      `the section ${JSON.stringify(sectionId)} is not pinned — the scenario proves nothing`,
    );
    assert.ok(
      landed.row.top >= landed.section.bottom - EDGE,
      `the row's top is at y=${Math.round(landed.row.top)}, above the pinned section's bottom ` +
        `at ${Math.round(landed.section.bottom)} — the jump put it behind the heading`,
    );
    assert.strictEqual(
      landed.hitRowId,
      id,
      `the element at the row's top edge is ${landed.hitKey ?? "nothing"}, not the row itself`,
    );
    assert.ok(
      landed.row.top < landed.section.bottom + 96,
      `the row is ${Math.round(landed.row.top - landed.section.bottom)}px below the pinned section, ` +
        "so the jump did not land where a jump lands",
    );
  },
);
Then(
  "the heading {string} is clear of the header",
  async function (this: OlaiWorld, text: string) {
    const heading = this.documentBody().locator(HEADINGS).filter({ hasText: text }).first();
    await heading.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const header = await this.box(this.page.locator(APP_HEADER), "the app header");
    const seam = header.y + header.height;

    const landed = await heading.evaluate((node) => ({
      top: node.getBoundingClientRect().top,
      moved: scrollY > 0,
    }));
    assert.ok(landed.moved, "the address changed and the page did not move");
    assert.ok(
      landed.top >= seam - 1,
      `the heading is at y=${Math.round(landed.top)}, above the header's bottom ` +
        `edge at ${Math.round(seam)} — the jump put it behind the bar`,
    );
    assert.ok(
      landed.top < seam + 96,
      `the heading is ${Math.round(landed.top - seam)}px below the header, so ` +
        "the jump did not land where a jump lands",
    );
  },
);


