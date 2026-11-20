import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import { retypedAndPressed, retypedAndTaken } from "@olai/tests/harness/atonce.ts";
import { countsNothing, expectExactCount } from "@olai/tests/harness/counted.ts";
import { WAITING, waitsIllegibly } from "@olai/tests/harness/paints.ts";
import { saysThat } from "@olai/tests/harness/said.ts";
import { keysSettled, pressed } from "@olai/tests/harness/settling.ts";
import { answered } from "@olai/tests/harness/shortlist.ts";
import {
  attr,
  HIT,
  HYDRATION_TIMEOUT,
  oneLine,
  PALETTE,
  PALETTE_CAPTURE,
  PALETTE_CONFIRM,
  PALETTE_INPUT,
  PALETTE_ITEM,
  PALETTE_SAID,
  SEARCH_COUNT,
  POLL_TIMEOUT,
  SHORTCUTS,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

When("I press the palette shortcut", async function (this: OlaiWorld) {
  // `ControlOrMeta` is Playwright's platform modifier: Meta on Darwin, Control elsewhere.
  await pressed(this, "ControlOrMeta+k");
});

Then("the command palette is open", async function (this: OlaiWorld) {
  await this.page
    .locator(PALETTE)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the command palette is closed", async function (this: OlaiWorld) {
  await this.page
    .locator(PALETTE)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

Then("the shortcuts are showing", async function (this: OlaiWorld) {
  await this.page
    .locator(SHORTCUTS)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the shortcuts are put away", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(SHORTCUTS).count()) === 0,
    "the shortcuts dialog to be gone",
  );
});

When("I press the palette scrim", async function (this: OlaiWorld) {
  const box = await this.page.locator(PALETTE).boundingBox();
  assert.ok(box !== null, "the palette is not on screen, so there is no outside to press");
  await this.page.mouse.click(box.x + box.width / 2, Math.max(1, box.y / 2));
  await this.waitForFrame();
});

When("I close the palette", async function (this: OlaiWorld) {
  await pressed(this, "Escape");
});

const paletteBox = async (world: OlaiWorld) => {
  const input = world.page.locator(PALETTE_INPUT);
  await input.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return input;
};

const fillPalette = async (world: OlaiWorld, text: string) => {
  const input = await paletteBox(world);
  await input.fill(text);
  return input;
};

When(
  "I type {string} into the palette",
  async function (this: OlaiWorld, text: string) {
    await fillPalette(this, text);
  },
);

When(
  "I retype the palette as {string} and press Enter at once",
  async function (this: OlaiWorld, text: string) {
    await retypedAndTaken(this, await paletteBox(this), text);
  },
);

When(
  "I retype the palette as {string} and press the node row {string} at once",
  async function (this: OlaiWorld, text: string, id: string) {
    await retypedAndPressed(
      this,
      await paletteBox(this),
      text,
      `${PALETTE_ITEM}${attr("data-id", `hit-#${id}`)}`,
    );
  },
);

When(
  "I ask the palette {string}",
  async function (this: OlaiWorld, text: string) {
    const input = await fillPalette(this, text);
    await input.press("Enter");
    await keysSettled(this);
  },
);

Then(
  "the palette box holds {string}",
  async function (this: OlaiWorld, text: string) {
    const box = this.page.locator(PALETTE_INPUT);
    await this.waitUntil(
      async () => (await box.inputValue()) === text,
      `the palette box to hold ${JSON.stringify(text)}`,
    ).catch(() => undefined);
    assert.strictEqual(await box.inputValue(), text, "the palette box");
  },
);

const rowsOf = async (world: OlaiWorld): Promise<ReadonlyArray<string>> => {
  await world.page
    .locator(PALETTE)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return (await world.page.locator(PALETTE_ITEM).allInnerTexts()).map(oneLine);
};

Then(
  "the palette offers {string}",
  async function (this: OlaiWorld, label: string) {
    await this.waitUntil(
      async () => (await rowsOf(this)).some((row) => row.includes(label)),
      `the palette to offer ${JSON.stringify(label)}`,
    );
  },
);

Then(
  "the palette does not offer {string}",
  async function (this: OlaiWorld, label: string) {
    await this.waitForFrame();
    const rows = await rowsOf(this);
    assert.ok(
      !rows.some((row) => row.includes(label)),
      `the palette offers ${JSON.stringify(label)}: ${rows.join(" | ")}`,
    );
  },
);

const paletteNode = (world: OlaiWorld, id: string) =>
  world.page.locator(`${PALETTE_ITEM}${attr("data-id", `hit-#${id}`)}`);

Then("the palette lists no node with id {string}", async function (this: OlaiWorld, id: string) {
  await this.waitUntil(async () => (await paletteNode(this, id).count()) === 0,
    `the palette to remove node ${JSON.stringify(id)}`);
});

Then(
  "the palette item for node {string} lights {string}",
  async function (this: OlaiWorld, id: string, said: string) {
    const row = paletteNode(this, id);
    const read = async () =>
      (await row.locator(HIT).allInnerTexts()).join(" ");
    await this.waitUntil(
      async () => (await read()) === said,
      `palette item for node \`${id}\` lights ${JSON.stringify(said)}`,
    ).catch(() => undefined);
    assert.strictEqual(
      await read(),
      said,
      `palette item for node \`${id}\` does not light ${JSON.stringify(said)}`,
    );
  },
);

Then(
  "the palette item for node {string} is waiting illegibly",
  async function (this: OlaiWorld, id: string) {
    await waitsIllegibly(
      this,
      paletteNode(this, id).locator(WAITING),
      `the palette item for node "${id}"`,
    );
  },
);

Then(
  "the palette item for node {string} is a button with no nested link",
  async function (this: OlaiWorld, id: string) {
    const row = paletteNode(this, id);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const tag = await row.evaluate((el) => el.tagName);
    assert.strictEqual(tag, "A", `palette item for node \`${id}\` is a ${tag}`);
    assert.strictEqual(
      await row.locator("a").count(),
      0,
      `palette item for node \`${id}\` nests a link`,
    );
  },
);

Then(
  "the palette lists the node {string}",
  async function (this: OlaiWorld, title: string) {
    await answered(this, PALETTE, await (await paletteBox(this)).inputValue());
    await this.page
      .locator(`${PALETTE_ITEM}[data-id^="hit-#"]`)
      .filter({ hasText: title })
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the palette lists the document {string}",
  async function (this: OlaiWorld, file: string) {
    await answered(this, PALETTE, await (await paletteBox(this)).inputValue());
    await this.page
      .locator(`${PALETTE_ITEM}${attr("data-id", `hit-${file}`)}`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the palette lists no document {string}",
  async function (this: OlaiWorld, file: string) {
    await answered(this, PALETTE, await (await paletteBox(this)).inputValue());
    const rows = await this.page
      .locator(`${PALETTE_ITEM}${attr("data-id", `hit-${file}`)}`)
      .count();
    assert.strictEqual(rows, 0, `the palette lists ${JSON.stringify(file)}`);
  },
);

Then(
  "the palette found {string}",
  async function (this: OlaiWorld, said: string) {
    await expectExactCount(this, `${PALETTE} ${SEARCH_COUNT}`, said, "palette count");
  },
);

Then(
  "the palette says nothing about a total",
  async function (this: OlaiWorld) {
    await countsNothing(this, `${PALETTE} ${SEARCH_COUNT}`, "palette");
  },
);

When(
  "I pick the palette item {string}",
  async function (this: OlaiWorld, label: string) {
    const item = this.page.locator(PALETTE_ITEM).filter({ hasText: label });
    await item.click();
    await this.page
      .locator(PALETTE)
      .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
  },
);

const boxHolds = async (world: OlaiWorld): Promise<string | null> => {
  const box = world.page.locator(PALETTE_INPUT);
  if ((await box.count()) === 0) return null;
  return await box.inputValue().catch(() => null);
};

When(
  "I choose {string} from the palette",
  async function (this: OlaiWorld, label: string) {
    const before = {
      asking: await this.page.locator(PALETTE_CONFIRM).count(),
      box: await boxHolds(this),
    };
    await this.page
      .locator(PALETTE_ITEM)
      .filter({ hasText: label })
      .first()
      .click();
    await this.waitUntil(
      async () =>
        (await this.page.locator(PALETTE).count()) === 0 ||
        (await this.page.locator(PALETTE_SAID).count()) > 0 ||
        (await this.page.locator(PALETTE_CONFIRM).count()) !== before.asking ||
        (await boxHolds(this)) !== before.box,
      `the palette to answer ${JSON.stringify(label)}`,
    );
  },
);

Then(
  "the palette asks {string}",
  async function (this: OlaiWorld, question: string) {
    const asking = this.page.locator(PALETTE_CONFIRM);
    await asking.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await asking.innerText()), question);
  },
);

Then(
  "the palette's caret is on {string}",
  async function (this: OlaiWorld, id: string) {
    const where = async () => await this.page.evaluate(() => {
      const at = document.activeElement
      return at === null ? "nothing" : `${at.tagName.toLowerCase()}${at.getAttribute("data-id") === null ? "" : `[${at.getAttribute("data-id")}]`}${at.getAttribute("data-testid") === null ? "" : `(${at.getAttribute("data-testid")})`}`
    })
    await this.waitUntil(
      async () =>
        (await this.page.evaluate(() =>
          document.activeElement?.getAttribute("data-id") ?? null
        )) === id,
      `the palette's caret to be on ${JSON.stringify(id)}`,
    ).catch(async () => {
      assert.fail(`the palette's caret is on ${await where()}, not ${JSON.stringify(id)}`)
    });
  },
);

Then(
  "Tab walks the palette and comes back to {string}",
  async function (this: OlaiWorld, id: string) {
    const stops: string[] = []
    for (let press = 0; press < 8; press++) {
      await this.page.keyboard.press("Tab")
      const at = await this.page.evaluate(() => {
        const active = document.activeElement
        const dialog = document.querySelector("dialog[open]")
        return {
          inside: active === null || active === document.body || active === document.documentElement
            || (dialog !== null && dialog.contains(active)),
          at: active?.getAttribute("data-id") ?? null,
          id: `${active?.tagName.toLowerCase() ?? "nothing"}:${active?.getAttribute("data-id") ?? active?.getAttribute("data-testid") ?? "-"}`,
          modal: dialog !== null && dialog.matches(":modal"),
          dialogs: document.querySelectorAll("dialog[open]").length,
        }
      })
      stops.push(at.id)
      assert.ok(at.inside, `Tab left the palette and landed on ${at.id} (modal: ${String(at.modal)}, open dialogs: ${String(at.dialogs)}, stops: ${stops.join(" → ")})`)
      if (at.at === id) return
    }
    assert.fail(`Tab never came back to ${JSON.stringify(id)} (stops: ${stops.join(" → ")})`)
  },
);

When("I click the palette box", async function (this: OlaiWorld) {
  await this.page.locator(PALETTE_INPUT).click();
});

Then("the palette is not asking anything", async function (this: OlaiWorld) {
  await this.page
    .locator(PALETTE_CONFIRM)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

Then(
  "the palette says {string}",
  async function (this: OlaiWorld, text: string) {
    await saysThat(this, PALETTE_SAID, text, "palette line", "alarm", this.page);
  },
);

Then(
  "the palette remarks {string}",
  async function (this: OlaiWorld, text: string) {
    await saysThat(this, PALETTE_SAID, text, "palette line", "aside", this.page);
  },
);

When("I wait for the palette write to finish", async function (this: OlaiWorld) {
  await keysSettled(this);
});

Then("the palette has no write response", async function (this: OlaiWorld) {
  assert.strictEqual(await this.page.locator(PALETTE_SAID).count(), 0);
});

When(
  "I capture {string} from the palette",
  async function (this: OlaiWorld, line: string) {
    const input = await fillPalette(this, `+ ${line}`);
    await input.press("Enter");
    await keysSettled(this);
  },
);

Then(
  "the palette previews the capture {string}",
  async function (this: OlaiWorld, text: string) {
    const preview = this.page.locator(PALETTE_CAPTURE);
    await preview.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await preview.innerText()), text);
  },
);

When("I move the palette cursor to {string}", async function(this: OlaiWorld, label: string) {
  const rows = this.page.locator(PALETTE_ITEM);
  const target = rows.filter({ hasText: label }).first();
  await target.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const limit = await rows.count() + 1;
  for (let i = 0; i < limit; i++) {
    await pressed(this, "ArrowDown");
    if (await target.getAttribute("data-active") === "true") return;
  }
  assert.fail(`the palette cursor did not reach ${label}`);
});
