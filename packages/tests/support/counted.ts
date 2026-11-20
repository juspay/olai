import * as assert from "node:assert";

import { POLL_TIMEOUT } from "./world.ts";
import type { OlaiWorld } from "./world.ts";

export const foundCount = async (
  world: OlaiWorld,
  locator: string,
  said: string,
  what: string,
): Promise<void> => {
  const line = world.page.locator(locator).first();
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  let text = "";
  await world.waitUntil(async () => {
    text = (await line.innerText().catch(() => "")).trim();
    return text === said;
  }, `the ${what} to say exactly ${JSON.stringify(said)}`).catch(() => undefined);
  assert.strictEqual(text, said, `the ${what} reads ${JSON.stringify(text)}`);
};

export const countsNothing = async (
  world: OlaiWorld,
  locator: string,
  what: string,
): Promise<void> => {
  await world.waitForFrame();
  const lines = world.page.locator(locator);
  const drawn = await lines.count();
  if (drawn === 0) return;
  assert.fail(
    `the ${what} says ${JSON.stringify(
      (await lines.first().innerText().catch(() => "")).trim(),
    )}`,
  );
};
