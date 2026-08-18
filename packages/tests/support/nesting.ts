/**
 * "IS THIS ROW DRAWN INSIDE THAT ONE" — the tree question, asked in a scope.
 *
 * Two step files ask it: `outline_tree_steps.ts` of the whole page, and
 * `drag_across_panes_steps.ts` of ONE pane, because a node id is unique in a
 * set and not on a screen — two panes showing one file draw every row of it
 * twice. The scope is the only difference, so the scope is the argument and
 * everything else is here once.
 *
 * THE NEGATIVE IS NOT THE POSITIVE NEGATED, and that is the whole reason this
 * is a pair rather than a boolean. A row that is drawn NOWHERE is also not a
 * child of anything, so a scenario asserting "it went somewhere else" would
 * pass over a tree that had lost the row entirely. {@link notChildOf} waits for
 * the parent to be on screen and for the child to be drawn SOMEWHERE, and only
 * then asks where.
 */

import * as assert from "node:assert";

import type { Locator } from "playwright";

import { nodeSelector, POLL_TIMEOUT } from "./world.ts";
import type { OlaiWorld } from "./world.ts";

/** The rows drawn inside `parent`, within `scope`. `.first()` on the parent
 *  because a scope may hold more than one drawing of it (a mirror's expansion,
 *  a second pane), and the outermost is the one a step means. */
const inside = (scope: Locator, parent: string, child: string): Locator =>
  scope.locator(nodeSelector(parent)).first().locator(nodeSelector(child));

/** `where` names the scope in a failure, so a message reads "in pane 1" rather
 *  than as a selector. */
export const childOf = async (
  world: OlaiWorld,
  scope: Locator,
  child: string,
  parent: string,
  where = "",
): Promise<void> => {
  const nested = inside(scope, parent, child);
  await nested
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
    .catch(() => undefined);
  assert.ok(
    (await nested.count()) > 0,
    `"${child}" is not rendered inside "${parent}"${where}`,
  );
};

export const notChildOf = async (
  world: OlaiWorld,
  scope: Locator,
  child: string,
  parent: string,
  where = "",
): Promise<void> => {
  await scope
    .locator(nodeSelector(parent))
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await world.waitUntil(
    async () =>
      (await scope.locator(nodeSelector(child)).count()) > 0 &&
      (await inside(scope, parent, child).count()) === 0,
    `"${child}" to be drawn${where} somewhere other than inside "${parent}"`,
  );
};
