/**
 * The client's own faults: what a reader sees when olai, rather than an
 * outline, is what is wrong.
 *
 * The whole difficulty here is PROVOKING one. Every other error surface in
 * this suite is reached by serving a file that does not validate, because
 * those errors are data. A bug in the render is not data, and this app
 * deliberately offers no way to ask for one — a fault switch shipped to
 * production is a fault switch in production.
 *
 * So it is injected from outside the bundle, into `String.prototype.padStart`
 * and only for the exact call the date arithmetic under the client makes
 * (`@olai/format`'s `calendar.ts` zero-padding, which the month grid and the
 * clock both run through before any page can be drawn). Narrow on purpose: a
 * builtin broken for everybody would take out the bundler's own runtime, a
 * dependency's module initialisation, or the fault card itself, and the
 * scenario would be proving something else.
 *
 * Effect rc.110 is that dependency: `Encoding.ts` fills a 256-entry hex table
 * at import with `i.toString(16).padStart(2, "0")`. That runs before there is
 * a tree to replace, so throwing on the first `(2, "0")` is a white tab for a
 * reason this scenario is not about. Those 256 are skipped; what throws is the
 * next `(2, "0")`, which is the client's own date pad, during a render.
 *
 * The coupling that buys is real and is answered rather than hidden: if that
 * call ever stops happening, the app draws itself perfectly and the step below
 * fails saying exactly that, in a second, instead of timing out with nothing
 * to say.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import {
  FAULT,
  FAULT_DETAIL,
  FAULT_HOME,
  oneLine,
  POLL_TIMEOUT,
  RELOAD,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** What the injected fault says. Asserted on later, so a card that drew SOME
 *  other error — a real one, provoked by the injection rather than being it —
 *  cannot pass for this one. */
const THROWN = "olai e2e: a deliberate fault in the render";

Given(
  "this client's own code throws while it draws",
  async function (this: OlaiWorld) {
    await this.page.addInitScript((message: string) => {
      const padStart = String.prototype.padStart;
      // Effect's hex table at import: one pad per byte, before any render.
      let hexTable = 256;
      String.prototype.padStart = function (
        this: string,
        length: number,
        fill?: string,
      ): string {
        // `(2, "0")` is the client's date pad — after the hex table, not
        // instead of it. See the file header.
        if (length === 2 && fill === "0") {
          if (hexTable > 0) hexTable -= 1;
          else throw new Error(message);
        }
        return padStart.call(this, length, fill);
      };
    }, THROWN);
  },
);

When("I open a page it cannot draw", async function (this: OlaiWorld) {
  // `settle`, not `open`: the same wait every scenario in the suite does, minus
  // the one line that REJECTS a fault card as the failure it is for all of
  // them. This is the scenario that wants one.
  //
  // NAMED when it times out, because for this scenario a settle that never saw
  // a shape is not noise — it is the white tab itself, the exact thing the
  // boundary exists to replace. Without this, removing the boundary reads as a
  // bare Playwright timeout instead of saying what came back: nothing.
  try {
    await this.settle("/");
  } catch (cause) {
    throw new Error(
      "nothing settled: no docked header, no error view, no fault card — a " +
        "white tab. The injected fault threw and nothing drew a card for it: " +
        "is the shell still wrapped in SurfaceFaultBoundary (main.tsx)?",
      { cause },
    );
  }
  assert.equal(
    await this.page.locator(FAULT).count(),
    1,
    "the app drew itself, so nothing was broken on the render path: the " +
      "injected fault (String.prototype.padStart(2, '0')) is no longer " +
      "something this client does while drawing a page. Point it at whatever " +
      "it does now — this scenario is about the boundary, not about dates.",
  );
});

Then("the page says it broke", async function (this: OlaiWorld) {
  await this.page
    .locator(FAULT)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  // The one sentence olai still owns. The boundary, the record and the printed
  // text are the framework's (`SurfaceFaultBoundary`), so what this app can
  // still get wrong is the LOOK — and its first words are this heading. By
  // ROLE, not testid: a card that demoted the sentence to a styled <div>
  // would have changed what a reader is handed while keeping every testid
  // in place.
  await this.page
    .getByRole("heading", { name: "This page broke" })
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the fault is on the page, verbatim", async function (this: OlaiWorld) {
  const detail = this.page.locator(FAULT_DETAIL);
  await detail.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const said = oneLine(await detail.innerText());
  assert.ok(
    said.includes(THROWN),
    `the card does not carry what threw; it says: ${said}`,
  );
});

Then("both ways out are offered", async function (this: OlaiWorld) {
  // A faulted render has no state left worth resuming, and a card that only
  // announced the fault would be a dead end with better manners. TWO, because
  // a fault is usually deterministic for the route it happened on: reload that
  // page and it breaks again, so the card also offers the way off it.
  for (const way of [RELOAD, FAULT_HOME]) {
    await this.page
      .locator(`${FAULT} ${way}`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  }
  assert.equal(
    await this.page.locator(`${FAULT} ${FAULT_HOME}`).getAttribute("href"),
    "/",
    "the way off the page that faulted has to be a real document navigation",
  );
});
