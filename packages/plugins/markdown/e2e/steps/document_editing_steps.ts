import * as assert from "node:assert";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import { isoDayOf } from "@olai/web/testlib";
import type { Page } from "@olai/tests/harness/playwright.ts";

import { saysThat } from "@olai/tests/harness/said.ts";
import {
  DAY_MINT,
  DAY_MINT_SAID,
  DAY_PAGE,
  DOCUMENT_BODY,
  DOCUMENT_EDIT,
  DOCUMENT_PAGE,
  expectAbsent,
  HYDRATION_TIMEOUT,
  oneLine,
  POLL_TIMEOUT,
} from "@olai/tests/harness/world.ts";
import {
  DOCUMENT_CANCEL,
  DOCUMENT_DRIFTED,
  DOCUMENT_EDITOR,
  DOCUMENT_OVERWRITE,
  DOCUMENT_SAID,
  DOCUMENT_SAVE,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

When("I start editing the document", async function (this: OlaiWorld) {
  const edit = this.frontLane().locator(`${DOCUMENT_EDIT}:visible`);
  await edit.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(edit);
  await this.frontLane()
    .locator(`${DOCUMENT_EDITOR}:visible`)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then(
  "the document editor holds text containing {string}",
  async function (this: OlaiWorld, text: string) {
    const editor = this.frontLane().locator(`${DOCUMENT_EDITOR}:visible`);
    await editor.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const held = await editor.inputValue();
    assert.ok(
      held.includes(text),
      `the editor holds ${JSON.stringify(oneLine(held))}, which does not ` +
        `contain ${JSON.stringify(text)}`,
    );
  },
);

Then(
  "the document editor holds no text containing {string}",
  async function (this: OlaiWorld, text: string) {
    const editor = this.frontLane().locator(`${DOCUMENT_EDITOR}:visible`);
    await editor.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const held = await editor.inputValue();
    assert.ok(
      !held.includes(text),
      `the editor holds ${JSON.stringify(oneLine(held))}, which carries ` +
        `${JSON.stringify(text)} — a draft has followed its typist onto ` +
        "another file",
    );
  },
);

When("I retype the document as:", async function (this: OlaiWorld, source: string) {
  const editor = this.frontLane().locator(`${DOCUMENT_EDITOR}:visible`);
  await editor.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await editor.fill(source);
});

When("I save the document", async function (this: OlaiWorld) {
  await this.press(this.frontLane().locator(`${DOCUMENT_SAVE}:visible`));
});

When("I cancel the document editor", async function (this: OlaiWorld) {
  await this.press(this.frontLane().locator(`${DOCUMENT_CANCEL}:visible`));
});

When("I overwrite the document anyway", async function (this: OlaiWorld) {
  await this.press(this.frontLane().locator(`${DOCUMENT_OVERWRITE}:visible`));
});

Then("the document editor is open", async function (this: OlaiWorld) {
  await this.frontLane()
    .locator(`${DOCUMENT_EDITOR}:visible`)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the document editor is gone", async function (this: OlaiWorld) {
  await this.frontLane()
    .locator(`${DOCUMENT_PAGE}:visible`).locator(DOCUMENT_EDITOR)
    .waitFor({ state: "detached", timeout: POLL_TIMEOUT });
});

Then("the editor notices the file changed on disk", async function (this: OlaiWorld) {
  await this.frontLane()
    .locator(`${DOCUMENT_DRIFTED}:visible`)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then(
  "the save is refused saying {string}",
  async function (this: OlaiWorld, said: string) {
    const refusal = this.frontLane().locator(`${DOCUMENT_SAID}:visible`);
    await refusal.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await refusal.getAttribute("data-tone"), "alarm");
    const text = oneLine(await refusal.innerText());
    assert.ok(
      text.includes(said),
      `the refusal reads ${JSON.stringify(text)}, which does not say ` +
        `${JSON.stringify(said)} — the ops layer's own words are the answer`,
    );
  },
);

let other: Page | undefined;

When("I switch to the other document tab", async function (this: OlaiWorld) {
  assert.ok(other !== undefined, "no second tab was opened");
  [this.page, other] = [other, this.page];
});

When("I draft {string} in document pane {int}", async function (this: OlaiWorld, text: string, index: number) {
  const pane = this.pane(index);
  await this.press(pane.locator(`${DOCUMENT_EDIT}:visible`));
  await pane.locator(`${DOCUMENT_EDITOR}:visible`).fill(text);
});

Then("document pane {int} holds draft {string}", async function (this: OlaiWorld, index: number, text: string) {
  const editor = this.pane(index).locator(`${DOCUMENT_EDITOR}:visible`);
  await editor.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(await editor.inputValue(), text);
});

When("I save document pane {int}", async function (this: OlaiWorld, index: number) {
  await this.press(this.pane(index).locator(`${DOCUMENT_SAVE}:visible`));
});

Then("document pane {int} has no editor", async function (this: OlaiWorld, index: number) {
  await this.pane(index).locator(`${DOCUMENT_PAGE}:visible`).locator(DOCUMENT_EDITOR)
    .waitFor({ state: "detached", timeout: POLL_TIMEOUT });
});

Given(
  "a second tab opens the document {string}",
  async function (this: OlaiWorld, file: string) {
    other = await this.context.newPage();
    await other.goto(`${this.baseUrl}/${file}`);
    await other
      .locator(DOCUMENT_EDITOR)
      .waitFor({ state: "detached", timeout: HYDRATION_TIMEOUT });
  },
);

Then(
  "the second tab renders bold text {string}",
  async function (this: OlaiWorld, text: string) {
    assert.ok(other !== undefined, "no second tab was opened");
    await this.rendersBold(other.locator(`${DOCUMENT_BODY}:visible`).first(), text);
  },
);

When("I press + day note", async function (this: OlaiWorld) {
  const mint = this.page.locator(DAY_MINT);
  await mint.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(mint);
});

Then("the + day note button is shown", async function (this: OlaiWorld) {
  await this.page
    .locator(DAY_MINT)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the + day note button is waiting for its write", async function (this: OlaiWorld) {
  assert.strictEqual(await this.page.locator(DAY_MINT).isDisabled(), true);
});

Then("the + day note button is ready", async function (this: OlaiWorld) {
  assert.strictEqual(await this.page.locator(DAY_MINT).isEnabled(), true);
});

Then("the + day note button is gone", async function (this: OlaiWorld) {
  await expectAbsent(
    this,
    DAY_PAGE,
    DAY_MINT,
    "a day that already has a note is still offering to mint one",
  );
});

Then(
  "the day-note mint is refused saying {string}",
  async function (this: OlaiWorld, said: string) {
    await saysThat(
      this,
      DAY_MINT_SAID,
      said,
      "refusal beside + day note",
      "alarm",
    );
  },
);

Then(
  "the document open is today's note under {string}",
  async function (this: OlaiWorld, root: string) {
    const today = isoDayOf(new Date());
    const wanted = `${root}/${today.slice(0, 4)}/${today.slice(5, 7)}/${today}.md`;
    await this.expectAttribute(
      DOCUMENT_PAGE,
      "data-file",
      wanted,
      "the document page",
      HYDRATION_TIMEOUT,
    );
  },
);

When("I mark the document editor element", async function (this: OlaiWorld) {
  await this.frontLane().locator(`${DOCUMENT_EDITOR}:visible`).evaluate((element) => {
    element.setAttribute("data-e2e-retained-editor", "original");
  });
});

Then("the original document editor element is still mounted", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.frontLane().locator(`${DOCUMENT_EDITOR}:visible`).getAttribute("data-e2e-retained-editor"),
    "original",
    "a roster change replaced the editor DOM element",
  );
});
