import * as assert from "node:assert";

import type { OlaiWorld } from "./world.ts";

export const manifestOf = async (
  world: OlaiWorld,
): Promise<Record<string, unknown>> => {
  const served = await world.fetch("/manifest.webmanifest");
  assert.strictEqual(
    served.status,
    200,
    `/manifest.webmanifest answered ${served.status}`,
  );
  return JSON.parse(served.body.toString()) as Record<string, unknown>;
};
