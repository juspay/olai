/**
 * The install surface, as a fetch: the manifest an installer reads.
 *
 * The HTTP contract itself is `packages/server/src/serve.test.ts`. What is
 * left here is the parse two plugins' steps reuse — whether the chrome an
 * installer opens under is the paper an unpicked page paints — so a second
 * fetch-and-parse is not a second copy of "an unmatched path answers 200
 * with the shell".
 *
 * IT IS THE HARNESS'S rather than a step file, and it was a step file
 * (`step_definitions/install_steps.ts`) holding NO STEP — only this function,
 * imported by the theme steps and by the app-name steps. Now that a step file
 * lives in the plugin whose surface it drives, a helper two plugins stand on is
 * the harness's by the same rule the shared selectors follow.
 */

import * as assert from "node:assert";

import type { OlaiWorld } from "./world.ts";

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
