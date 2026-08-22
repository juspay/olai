/**
 * A CHUNK, to a scenario: something the page asks for later, that a step can
 * hold up, let through, or refuse.
 *
 * Two of them are split out of this client now — the markdown pipeline
 * (`web/src/client/markdown/chunk.ts`) and the `•••` menu's primitive
 * (`web/src/client/menu/chunk.ts`) — and what a scenario wants to say about
 * either is the same four things: nothing has asked for it, it was asked for
 * exactly once, it is on its way and has not landed, it is never coming. That
 * is a receptacle, and the client grew the matching one on its own side of the
 * wire for the same reason (`web/src/client/arriving.ts`).
 *
 * THE URL IS DERIVED, not written twice. `buildSurfaceClient` names a split
 * chunk `[name]-[hash].js` under the hashed asset prefix, where the name is the
 * split module's own — so `markdown/pipeline.ts` lands as `pipeline-<hash>.js`
 * and `menu/Dropdown.tsx` as `Dropdown-<hash>.js`. One caller names the module;
 * the bundler's rule is spelled here.
 *
 * The failure this has to stay legible for is NAMING ROT rather than a broken
 * page: if that rule moves, every step built on this goes quiet in the same way
 * — "the page never asked" — and the log has to be enough to tell that from a
 * page that genuinely did not ask. So {@link Chunk.diagnosis} prints the
 * pattern beside every `/_olai/assets/*` the page DID fetch, and the two together
 * name the mismatch without anybody opening this file.
 */

import * as assert from "node:assert";
import type { Route } from "playwright";

import { ASSET_PREFIX } from "@olai/surface";

import type { OlaiWorld } from "./world.ts";

export interface Chunk {
  /** Sit on every request for it, so a scenario can stand in the moment BEFORE
   *  it lands rather than race it. Register before the page is opened. */
  holdUp: (world: OlaiWorld) => Promise<void>;
  /** Refuse it, for good. */
  neverArrives: (world: OlaiWorld) => Promise<void>;
  /** Let through what {@link holdUp} is sitting on. */
  arrive: (world: OlaiWorld) => Promise<void>;
  /** Every request the page has made for it. */
  asked: (world: OlaiWorld) => ReadonlyArray<string>;
  /** What to print when a step expected it to have been asked for and it was
   *  not. */
  diagnosis: (world: OlaiWorld) => string;
}

/**
 * @param what the chunk as a scenario names it ("the markdown pipeline"), for
 * the assertion messages.
 * @param module the split module's own name, which is what the bundler names
 * the chunk after: `pipeline`, `Dropdown`.
 */
export const chunkOf = (what: string, module: string): Chunk => {
  const url = new RegExp(`${ASSET_PREFIX}${module}-[^/]+\\.js$`);
  const asked = (world: OlaiWorld): ReadonlyArray<string> =>
    world.requests.filter((one) => url.test(one));
  const diagnosis = (world: OlaiWorld): string => {
    const assets = world.requests.filter((one) => one.includes(ASSET_PREFIX));
    return [
      `expected a request matching ${url}`,
      ...(assets.length === 0
        ? [`this page fetched nothing under ${ASSET_PREFIX} at all`]
        : [`the ${ASSET_PREFIX}* this page did fetch:`, ...assets.map((one) => `  ${one}`)]),
    ].join("\n  ");
  };

  return {
    asked,
    diagnosis,
    holdUp: async (world) => {
      const held: Route[] = [];
      world.heldChunks.set(module, held);
      // Registered before the page is opened, so it catches the fetch whenever
      // the app makes it — the point of the scenario is that it has not
      // arrived YET.
      await world.page.route(url, (route) => {
        held.push(route);
      });
    },
    neverArrives: async (world) => {
      await world.page.route(url, (route) => route.abort("failed"));
    },
    arrive: async (world) => {
      const held = world.heldChunks.get(module);
      assert.ok(held !== undefined, `nothing is holding ${what} up, so there is nothing to let through`);
      assert.ok(
        held.length > 0,
        `the page never asked for ${what}, so letting it through proves nothing\n  ${
          diagnosis(world)
        }`,
      );
      for (const route of held) await route.continue();
      world.heldChunks.set(module, []);
      await world.waitForFrame();
    },
  };
};
