import * as assert from "node:assert";
import type { Page, Locator } from "./playwright.ts";

import { POLL_TIMEOUT } from "./world.ts";
import type { OlaiWorld } from "./world.ts";

export const announcedAs = async (
  world: OlaiWorld,
  locator: string,
  urgency: "at once" | "politely",
  what: string,
): Promise<void> => {
  const [role, live] = urgency === "at once"
    ? ["alert", "assertive"]
    : ["status", "polite"];
  await world.expectAttribute(locator, "role", role, what);
  await world.expectAttribute(locator, "aria-live", live, what);
};

export const saysThat = async (
  world: OlaiWorld,
  locator: string,
  said: string,
  what: string,
  tone?: "alarm" | "aside",
  scope: Page | Locator = world.frontLane(),
): Promise<void> => {
  const line = scope.locator(`${locator}:visible`).first();
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const text = (await line.innerText()).trim();
  assert.ok(
    text.includes(said),
    `the ${what} reads ${JSON.stringify(text)}, which does not mention ${
      JSON.stringify(said)
    }`,
  );
  if (tone === undefined) return;
  await inTheMood(world, locator, tone, what, scope);
};

export const inTheMood = async (
  world: OlaiWorld,
  locator: string,
  tone: "alarm" | "aside",
  what: string,
  scope: Page | Locator = world.frontLane(),
): Promise<void> => {
  await world.expectAttribute(`${locator}:visible`, "data-tone", tone, what, POLL_TIMEOUT, scope);
};

export const saysNothing = async (
  world: OlaiWorld,
  locators: ReadonlyArray<string>,
  what: string,
): Promise<void> => {
  await world.waitUntil(async () => {
    for (const locator of locators) {
      if ((await world.page.locator(locator).count()) > 0) return false;
    }
    return true;
  }, what);
};
