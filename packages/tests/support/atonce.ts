import type { Locator } from "playwright";

import { keysSettled } from "./settling.ts";
import type { OlaiWorld } from "./world.ts";

export const retypedAndTaken = async (
  world: OlaiWorld,
  box: Locator,
  text: string,
): Promise<void> => {
  await box.evaluate((element, wanted) => {
    const field = element as HTMLInputElement | HTMLTextAreaElement;
    field.focus();
    field.value = wanted;
    field.setSelectionRange(wanted.length, wanted.length);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
  }, text);
  await keysSettled(world);
};

export const retypedAndPressed = async (
  world: OlaiWorld,
  box: Locator,
  text: string,
  row: string,
): Promise<void> => {
  await box.evaluate((element, { wanted, row }) => {
    const field = element as HTMLInputElement | HTMLTextAreaElement;
    field.focus();
    field.value = wanted;
    field.setSelectionRange(wanted.length, wanted.length);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    const pressed = document.querySelector(row);
    if (pressed === null) {
      throw new Error(`no row matching ${row} to press`);
    }
    (pressed as HTMLElement).click();
  }, { wanted: text, row });
  await world.waitForFrame();
};
