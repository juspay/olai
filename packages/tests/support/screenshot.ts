/**
 * SAVING A PICTURE FOR A PERSON TO LOOK AT — evidence, never an assertion.
 *
 * Where it lands is the e2e recipe's to say: `$OLAI_E2E_EVIDENCE/
 * $OLAI_E2E_ATTEMPT/screenshots/<name>`, or `$OLAI_SHOTS` when a driver asks
 * for its own directory. A run that names neither saves nothing, so a
 * scenario that takes pictures still runs, and still asserts, everywhere.
 *
 * Here rather than in `step_definitions/app_steps.ts` because more than one
 * package's steps take pictures: the generic `I save a screenshot as` step,
 * and the theme row's walk through every palette.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { Locator } from "playwright";

import type { OlaiWorld } from "./world.ts";

/** Save the whole page as `name` — or just `element`, when the picture is of
 *  one control rather than of the page it sits on. */
export const saveScreenshot = async (world: OlaiWorld, name: string, element?: Locator): Promise<void> => {
  const evidence = process.env.OLAI_E2E_EVIDENCE;
  const attempt = process.env.OLAI_E2E_ATTEMPT;
  const dir = process.env.OLAI_SHOTS ?? (evidence && attempt ? join(evidence, attempt, "screenshots") : undefined);
  if (dir === undefined || dir === "") return;
  mkdirSync(dir, { recursive: true });
  if (element !== undefined) {
    await element.screenshot({ path: join(dir, name) });
    return;
  }
  // Full-page capture must start at the top, or Chromium places fixed chrome
  // at the old viewport offset in the stitched image.
  await world.page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await world.waitForFrame();
  await world.page.screenshot({ path: join(dir, name), fullPage: true });
};
