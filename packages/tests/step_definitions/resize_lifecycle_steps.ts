import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import { SIDEBAR, SIDEBAR_RESIZE, type OlaiWorld } from "../support/world.ts";

const held = new WeakMap<OlaiWorld, { x: number; y: number; width: number }>();

When("I hold the sidebar resize after widening it by {int}px", async function (this: OlaiWorld, dx: number) {
  const before = await this.box(this.page.locator(SIDEBAR), "sidebar");
  const handle = await this.box(this.page.locator(SIDEBAR_RESIZE), "sidebar resize handle");
  const x = handle.x + handle.width / 2;
  const y = handle.y + handle.height / 2;
  await this.page.mouse.move(x, y);
  await this.page.mouse.down();
  await this.page.mouse.move(x + dx, y, { steps: 8 });
  await this.waitUntil(async () => {
    const box = await this.page.locator(SIDEBAR).boundingBox();
    return box !== null && Math.abs(box.width - before.width - dx) <= 1;
  }, "the held resize to reach its requested width");
  held.set(this, { x: x + dx, y, width: before.width + dx });
});

When("I move the held resize pointer another {int}px", async function (this: OlaiWorld, dx: number) {
  const at = held.get(this);
  assert.ok(at, "no held resize");
  await this.page.mouse.move(at.x + dx, at.y, { steps: 8 });
  await this.waitForFrame();
});

Then("the sidebar retains the width reached before cancellation", async function (this: OlaiWorld) {
  const at = held.get(this);
  assert.ok(at, "no held resize");
  const box = await this.box(this.page.locator(SIDEBAR), "sidebar");
  assert.ok(Math.abs(box.width - at.width) <= 1, `sidebar width ${box.width}, expected ${at.width}`);
});
