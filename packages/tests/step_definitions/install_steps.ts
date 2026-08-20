/**
 * The install surface, as a fetch: the manifest an installer reads.
 *
 * The HTTP contract itself is `packages/server/src/serve.test.ts`. What is
 * left here is the parse the theme steps reuse — whether the chrome an
 * installer opens under is the paper an unpicked page paints — so a second
 * fetch-and-parse is not a second copy of "an unmatched path answers 200
 * with the shell".
 */

import * as assert from "node:assert";

import type { OlaiWorld } from "../support/world.ts";

/** The manifest, parsed. Fetched per step rather than cached on the world: it
 *  is a static document served by the process under test, and a step that read
 *  a copy from three steps ago would not be reading what is being served. */
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
