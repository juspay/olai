import type { Page } from "playwright";

import { KEYS_SETTLING } from "@olai/web/testlib";

import { POLL_TIMEOUT } from "./world.ts";
import type { OlaiWorld } from "./world.ts";

const QUIET = `[${KEYS_SETTLING}="0"]`;
const COUNTER = `[${KEYS_SETTLING}]`;

export const keysSettled = async (
  world: OlaiWorld,
  page: Page = world.page,
): Promise<void> => {
  try {
    await page.locator(QUIET).first().waitFor({
      state: "attached",
      timeout: POLL_TIMEOUT,
    });
  } catch {
    const held = await page
      .locator(COUNTER)
      .first()
      .getAttribute(KEYS_SETTLING)
      .catch(() => null);
    throw new Error(
      held === null
        ? `timed out after ${POLL_TIMEOUT}ms waiting for the client to finish ` +
          `with the keys: no ${KEYS_SETTLING} on the page at all, so the app ` +
          `shell is not drawn`
        : `timed out after ${POLL_TIMEOUT}ms waiting for the client to finish ` +
          `with the keys — it is still handling ${held}`,
    );
  }
};

export const pressed = async (world: OlaiWorld, key: string): Promise<void> => {
  await world.page.keyboard.press(key);
  await keysSettled(world);
};

export const typed = async (world: OlaiWorld, text: string): Promise<void> => {
  await world.page.keyboard.type(text);
  await keysSettled(world);
};
