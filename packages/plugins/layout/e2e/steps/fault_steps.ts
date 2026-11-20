import { TESTID } from "@olai/tests/harness/testids.ts"
import * as assert from "node:assert";

import { Given, Then, When } from "@olai/tests/harness/runner.ts";

import {
  FAULT,
  FAULT_DETAIL,
  oneLine,
  POLL_TIMEOUT,
  RELOAD,
} from "@olai/tests/harness/world.ts";
import {
  FAULT_HOME,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const THROWN = "olai e2e: a deliberate fault in the render";

Given(
  "this client's own code throws while it draws",
  async function (this: OlaiWorld) {
    await this.page.addInitScript(({ message, header }) => {
      const setAttribute = Element.prototype.setAttribute;
      let armed = true;
      Element.prototype.setAttribute = function (name: string, value: string): void {
        if (armed && name === "data-testid" && value === header) {
          armed = false;
          throw new Error(message);
        }
        setAttribute.call(this, name, value);
      };
    }, { message: THROWN, header: TESTID.appHeader });
  },
);

When("I open a page it cannot draw", async function (this: OlaiWorld) {
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
      "injected header DOM fault is no longer " +
      "something this client does while drawing a page. Point it at whatever " +
      "it does now — this scenario is about the rendering boundary.",
  );
});

Then("the page says it broke", async function (this: OlaiWorld) {
  await this.page
    .locator(FAULT)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page
    .getByRole("heading", { name: "Something went wrong on this page" })
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page
    .locator(FAULT)
    .getByText("Your files are safe. Reload to try again.", { exact: true })
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the fault's detail is behind a closed Details", async function (this: OlaiWorld) {
  const detail = this.page.locator(FAULT_DETAIL);
  await detail.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
  assert.equal(await detail.isVisible(), false, "the fault's text is on show before anybody asked for it");
  assert.equal(
    await detail.evaluate((el) => el.closest("details")?.open ?? null),
    false,
    "the fault's text is not inside a closed <details>",
  );
});

When("I open the fault's Details", async function (this: OlaiWorld) {
  await this.press(this.page.locator(FAULT).getByText("Details", { exact: true }));
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
  for (const way of [RELOAD, FAULT_HOME]) {
    await this.page
      .locator(`${FAULT} ${way}`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  }
  assert.equal((await this.page.locator(`${FAULT} ${RELOAD}`).innerText()).trim(), "Reload");
  assert.equal((await this.page.locator(`${FAULT} ${FAULT_HOME}`).innerText()).trim(), "Go home");
  assert.equal(
    await this.page.locator(`${FAULT} ${FAULT_HOME}`).getAttribute("href"),
    "/",
    "the way off the page that faulted has to be a real document navigation",
  );
});
