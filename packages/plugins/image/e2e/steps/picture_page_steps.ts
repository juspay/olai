/**
 * The one step this row needs that nothing else in the suite can say for it.
 *
 * Everything else about a picture's page is already a sentence somebody else
 * owns — the address, the file the `<img>` is pointed at, whether the bytes
 * came back — and those are reused here rather than respelled, because a
 * second way of asking "did this picture load" is a second thing that can rot.
 * What is this row's alone is the PRIORITY: a picture that is the whole page
 * is the page's largest paint, and the two attributes that say so are the two
 * a drive-by edit would quietly drop while the page went on looking identical.
 */

import * as assert from "node:assert";
import { Then } from "@olai/tests/harness/runner.ts";
import { IMAGE_VIEW, POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

Then("the picture that is the page is fetched first", async function (this: OlaiWorld) {
  const picture = this.page.locator(IMAGE_VIEW);
  await picture.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  // EAGER, said rather than defaulted: the page would look the same with
  // `lazy` on a fast machine and be a frame of nothing on a slow one.
  assert.strictEqual(await picture.getAttribute("loading"), "eager");
  // …and ahead of the page's other fetches, which is the half `eager` alone
  // does not buy: without it the browser only raises an image's priority once
  // layout has found it in the viewport.
  assert.strictEqual(await picture.getAttribute("fetchpriority"), "high");
  // The decode still goes off the main thread — early is about the bytes, not
  // about blocking the frame the rest of the page paints in.
  assert.strictEqual(await picture.getAttribute("decoding"), "async");
});
