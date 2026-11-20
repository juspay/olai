import * as assert from "node:assert";

import type { Locator } from "playwright";

import { nodeSelector, POLL_TIMEOUT } from "./world.ts";
import type { OlaiWorld } from "./world.ts";

const inside = (scope: Locator, parent: string, child: string): Locator =>
  scope.locator(nodeSelector(parent)).first().locator(`:scope > ul > ${nodeSelector(child)}`);

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
