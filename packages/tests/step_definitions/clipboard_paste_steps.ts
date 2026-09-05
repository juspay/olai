import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import type { OlaiWorld } from "../support/world.ts";
import { pressed } from "../support/settling.ts";

When("I paste this text into the focused field:", async function (this: OlaiWorld, text: string) {
  await this.context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(this.page.url()).origin,
  });
  await this.page.evaluate(async (value) => navigator.clipboard.writeText(value), text);
  await pressed(this, "ControlOrMeta+v");
});

Then("the focused text field holds:", async function (this: OlaiWorld, text: string) {
  const actual = await this.page.evaluate(() => {
    const field = document.activeElement;
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
      throw new Error("no text field has focus");
    }
    return field.value;
  });
  assert.equal(actual, text);
});

Then("the note of {string} in {string} is:", async function (this: OlaiWorld, id: string, file: string, text: string) {
  await this.waitUntil(async () => this.servedNodesSoFar(file).some((node) => node["id"] === id && node["desc"] === text),
    `the saved note of ${id} to equal ${JSON.stringify(text)}`);
});
