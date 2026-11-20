import { CARET_EDITOR, COMPLETIONS, EDIT_REFUSAL, NEW_ROW, NODE } from "./world.ts";
import type { OlaiWorld } from "./world.ts";

const somethingIsBeingTyped = async (world: OlaiWorld): Promise<boolean> =>
  (await world.page.locator(CARET_EDITOR).count()) > 0;

const refused = async (world: OlaiWorld): Promise<boolean> =>
  (await world.page.locator(EDIT_REFUSAL).count()) > 0;

export const theListIsGone = async (world: OlaiWorld): Promise<void> => {
  await world.waitUntil(
    async () => (await world.page.locator(COMPLETIONS).count()) === 0,
    "the completion list to go",
  );
};

export const nothingIsBeingTyped = async (world: OlaiWorld): Promise<void> => {
  await world.waitUntil(
    async () => !(await somethingIsBeingTyped(world)),
    "the draft to close",
  );
};

const caretPlace = async (world: OlaiWorld): Promise<string | null> =>
  await world.page.evaluate(
    ([caret, newRow, node]) => {
      const editor = document.activeElement;
      if (editor === null || !editor.matches(caret)) return null;
      const row = editor.closest(node);
      let place = "(off the tree)";
      if (row !== null) {
        const chain: Array<string> = [];
        for (
          let at: Element | null = row;
          at !== null;
          at = at.parentElement?.closest(node) ?? null
        ) {
          chain.unshift(at.getAttribute("data-node-id") ?? "?");
        }
        let seat = 0;
        for (let before = row.previousElementSibling; before !== null; ) {
          if (before.matches(node)) seat += 1;
          before = before.previousElementSibling;
        }
        place = `${chain.join("/")}@${seat}`;
      }
      return editor.closest(newRow) === null ? place : `a new line after ${place}`;
    },
    [CARET_EDITOR, NEW_ROW, NODE] as [string, string, string],
  );

export const leavingTheLine = async (
  world: OlaiWorld,
  gesture: () => Promise<void>,
  what: string,
): Promise<void> => {
  const was = await caretPlace(world);
  await gesture();
  if (was === null) return;
  await world.waitUntil(
    async () => (await caretPlace(world)) !== was || (await refused(world)),
    `${what}, or the page to say why it did not`,
  );
};

export const focusedOn = (world: OlaiWorld): Promise<string> =>
  world.page.evaluate(() => {
    const element = document.activeElement;
    if (element === null || element === document.body) return "nothing";
    const testid = element.getAttribute("data-testid");
    const value = element.getAttribute("data-value");
    return `${testid ?? element.tagName.toLowerCase()}${
      value === null ? "" : `=${value}`
    }`;
  });
