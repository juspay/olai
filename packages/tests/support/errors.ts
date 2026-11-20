import * as assert from "node:assert";
import type { Locator } from "playwright";

import { attr, ERROR_ROW, HYDRATION_TIMEOUT, oneLine, POLL_TIMEOUT } from "./world.ts";

export const rowsIn = async (scope: Locator): Promise<Array<string>> =>
  (await scope.locator(ERROR_ROW).allInnerTexts()).map(oneLine);

export const showScope = async (scope: Locator): Promise<void> => {
  await scope.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
};

export const expectCodeIn = async (
  scope: Locator,
  code: string,
  what: string,
): Promise<void> => {
  await showScope(scope);
  const row = scope.locator(`${ERROR_ROW}${attr("data-code", code)}`);
  await row
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
    .catch(() => undefined);
  assert.ok(
    (await row.count()) > 0,
    `${what} lists no error with code "${code}"; it shows:\n  ` +
      (await rowsIn(scope)).join("\n  "),
  );
};

export const expectSiteIn = async (
  scope: Locator,
  site: string,
  what: string,
): Promise<void> => {
  await showScope(scope);
  const rows = await rowsIn(scope);
  assert.ok(
    rows.some((text) => text.includes(site)),
    `${what} names no error at ${site}; it shows:\n  ${rows.join("\n  ")}`,
  );
};
