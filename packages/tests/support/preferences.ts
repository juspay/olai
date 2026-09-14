/**
 * OPENING THE PREFERENCES PANEL, and reading one row of it — the three actions
 * that more than one plugin's steps stand on.
 *
 * They were exported out of `preferences_steps.ts`, and the export was the
 * smell: the theme steps opened the panel to reach the chips, the reminder
 * steps opened it to set the alert switches, and the font steps opened it to
 * pick a face — three plugins reaching into a fourth plugin's step file for a
 * gesture none of them owns. Now that each plugin keeps its own steps under its
 * own `e2e/`, that import would be a package reaching past another package's
 * doors for a private module, which is the one shape this tree does not allow.
 *
 * The rule it follows is the harness's own, and it is the same one the shared
 * selectors follow: WHAT MORE THAN ONE PLUGIN'S STEPS STAND ON IS THE
 * HARNESS'S. `preferences_steps.ts` still owns every CLAIM about the panel —
 * what a row says, what a pick means, what is stored and what is never sent;
 * what is here is only the way in.
 */

import type { Page } from "playwright";

import {
  attr,
  HYDRATION_TIMEOUT,
  POLL_TIMEOUT,
  PREFS_CHOICE,
  PREFS_HINT,
  PREFS_PANEL,
  PREFS_ROW,
  PREFS_TRIGGER,
  SIDEBAR_BODY,
  SIDEBAR_TOGGLE,
} from "./world.ts";
import type { OlaiWorld } from "./world.ts";

/** Open the panel unless it is already open. Idempotent, because a scenario
 *  that opened it to pick a theme should not have to know whether the step
 *  after it needs opening again. */
export const showPreferences = async (page: Page): Promise<void> => {
  const panel = page.locator(PREFS_PANEL);
  if (await panel.isVisible().catch(() => false)) return;
  const trigger = page.locator(PREFS_TRIGGER);
  if (!(await trigger.isVisible().catch(() => false))) {
    // Phone: the trigger is a row in the directory drawer.
    const burger = page.locator(SIDEBAR_TOGGLE);
    await burger.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await burger.click();
    await page.locator(SIDEBAR_BODY).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  }
  await trigger.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await trigger.click();
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
};

/** One row of it, by the preference it sets rather than by its position: rows
 *  are a list somebody will reorder. */
export const prefRow = (world: OlaiWorld, pref: string) =>
  world.page.locator(`${PREFS_ROW}${attr("data-pref", pref)}`);

/** What that row says the choice in force MEANS. Read by the theme steps too,
 *  for the promise the retired header pill used to keep. */
export const hintOf = async (
  world: OlaiWorld,
  pref: string,
): Promise<string> => {
  await showPreferences(world.page);
  const hint = prefRow(world, pref).locator(PREFS_HINT);
  await hint.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return await hint.innerText();
};

/**
 * Press one segment of one row, and wait for the panel to say it took.
 *
 * ONE spelling for every segmented row there is — Done, Notes, Size, Git —
 * because they are one control (`client/settings/Segmented.tsx`) and the wait
 * is the subtle half: pressing and carrying on races the render, and each row
 * having its own copy of that wait is how the third one gets it slightly wrong.
 */
export const pickChoice = async (
  page: Page,
  pref: string,
  value: string,
): Promise<void> => {
  await showPreferences(page);
  const choice = page.locator(
    `${PREFS_ROW}${attr("data-pref", pref)} ${PREFS_CHOICE}${attr("data-value", value)}`,
  );
  await choice.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await choice.click();
  await choice
    .and(page.locator('[aria-pressed="true"]'))
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
    .catch(() => {
      throw new Error(`the ${pref} row never took "${value}"`);
    });
};
