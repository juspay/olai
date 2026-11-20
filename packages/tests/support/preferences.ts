import type { Page } from "playwright";

import {
  attr,
  HYDRATION_TIMEOUT,
  POLL_TIMEOUT,
  PREFS_CHOICE,
  PREFS_HINT,
  PREFS_PANEL,
  PREFS_ROW,
  PREFS_SWITCH,
  PREFS_TRIGGER,
  SIDEBAR_BODY,
  SIDEBAR_TOGGLE,
} from "./world.ts";
import type { OlaiWorld } from "./world.ts";

export const showPreferences = async (page: Page): Promise<void> => {
  const panel = page.locator(PREFS_PANEL);
  if (await panel.isVisible().catch(() => false)) return;
  const trigger = page.locator(PREFS_TRIGGER);
  if (!(await trigger.isVisible().catch(() => false))) {
    const burger = page.locator(SIDEBAR_TOGGLE);
    await burger.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await burger.click();
    await page.locator(SIDEBAR_BODY).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  }
  await trigger.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await trigger.click();
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
};

export const prefRow = (world: OlaiWorld, pref: string) =>
  world.page.locator(`${PREFS_ROW}${attr("data-pref", pref)}`);

export const hintOf = async (
  world: OlaiWorld,
  pref: string,
): Promise<string> => {
  await showPreferences(world.page);
  const hint = prefRow(world, pref).locator(PREFS_HINT);
  await hint.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return await hint.innerText();
};

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

export const setSwitch = async (
  page: Page,
  pref: string,
  on: boolean,
): Promise<void> => {
  await showPreferences(page);
  const toggle = page.locator(`${PREFS_ROW}${attr("data-pref", pref)} ${PREFS_SWITCH}`);
  await toggle.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  if ((await toggle.getAttribute("aria-checked")) !== String(on)) await toggle.click();
  await toggle
    .and(page.locator(attr("aria-checked", String(on))))
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
    .catch(() => {
      throw new Error(`the ${pref} switch never went ${on ? "on" : "off"}`);
    });
};
