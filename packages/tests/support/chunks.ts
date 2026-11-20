import * as assert from "node:assert";
import type { Route } from "playwright";

import { ASSET_PREFIX, chunkUrl } from "@olai/surface";

import type { OlaiWorld } from "./world.ts";

export interface Chunk {
  readonly url: RegExp;
  /** Register before the page is opened. */
  holdUp: (world: OlaiWorld) => Promise<void>;
  neverArrives: (world: OlaiWorld) => Promise<void>;
  arrive: (world: OlaiWorld) => Promise<void>;
  asked: (world: OlaiWorld) => ReadonlyArray<string>;
  diagnosis: (world: OlaiWorld) => string;
}

export const chunkOf = (what: string, module: string): Chunk => {
  const url = chunkUrl(module);
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
    url,
    asked,
    diagnosis,
    holdUp: async (world) => {
      const held: Route[] = [];
      world.heldChunks.set(module, held);
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
