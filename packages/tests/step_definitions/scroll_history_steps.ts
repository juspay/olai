import { Given, Then, When } from "@cucumber/cucumber";
import type { OlaiWorld } from "../support/world.ts";

const outline = (count: number): string => Array.from({ length: count }, (_, i) =>
  JSON.stringify({ id: `scroll-row-${i}`, ord: `a${String(i).padStart(2, "0")}`, title: `Row ${i} for scroll history` }),
).join("\n");

Given("an outline and a taller document for scroll history", function (this: OlaiWorld) {
  this.writeServed("scroll-history.olai", outline(40));
  this.writeServed("scroll-history.md", Array.from({ length: 80 }, (_, i) =>
    `Paragraph ${i} of the tall document.`,
  ).join("\n\n"));
});

When("I shorten the scroll history outline to {int} rows", function (this: OlaiWorld, count: number) {
  this.writeServed("scroll-history.olai", outline(count));
});

Then("the page is at the bottom", async function (this: OlaiWorld) {
  await this.waitUntil(() => this.page.evaluate(() => {
    const bottom = document.documentElement.scrollHeight - innerHeight;
    return bottom > 0 && Math.abs(scrollY - bottom) <= 2;
  }), "the page to reach its current bottom");
});

When("I wheel to the top of the reading pane", async function (this: OlaiWorld) {
  const viewport = await this.page.evaluate(() => ({
    width: innerWidth, height: innerHeight, total: document.documentElement.scrollHeight,
  }));
  await this.page.mouse.move(viewport.width * 0.75, viewport.height * 0.65);
  await this.page.mouse.wheel(0, -viewport.total);
  await this.waitForFrame();
});
