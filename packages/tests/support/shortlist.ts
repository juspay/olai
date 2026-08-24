/**
 * WAITING FOR A SHORTLIST — the one ritual every panel in this suite that
 * searches has to perform, and the reason it is not written out per panel.
 *
 * Three surfaces draw `client/search/Shortlist.tsx` over one `createSearch`
 * (the edge panel, the move picker) or the same primitive by hand, and each of
 * them is a box somebody types into and a list the server answers a moment
 * later. What a step has to wait for is not "some rows appeared" but THE ROWS
 * OF THIS QUERY: a shortlist HOLDS STILL through the settle and the round trip
 * after it — the rows a reader is looking at stay until the next ones arrive —
 * so a wait for any visible hit is a wait the FIRST search in a scenario
 * satisfies for the second.
 *
 * `data-asked` is the component's own answer to "which query are these rows
 * for" (`client/search/Shortlist.tsx`, over `client/settled.ts`'s `answering`),
 * and it is absent while they answer one the reader has typed past. So that is
 * what this waits on, and then for the list under it.
 *
 * Its own module for `./caret.ts`'s reason, word for word: this is a RITUAL
 * rather than a step, more than one step file wants it, and two of them waiting
 * for the client's answer two different ways is how one of them stops waiting
 * properly. It was two copies differing only in a pair of selectors.
 */

import { attr, POLL_TIMEOUT } from "./world.ts";
import type { OlaiWorld } from "./world.ts";

/**
 * The rows under `panel` answer `text`, and there is at least one of them.
 *
 * Trimmed, because the query the search is asked is the trimmed one. The
 * attribute is looked for INSIDE the panel rather than on it: it is a fact
 * about the SEARCH, and the search is a component the panel draws rather than
 * something the panel is.
 */
export const answering = async (
  world: OlaiWorld,
  panel: string,
  hit: string,
  text: string,
): Promise<void> => {
  await answered(world, panel, text);
  await world.page
    .locator(hit)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
};

/**
 * THE QUERY HAS BEEN ANSWERED — without requiring a hit.
 *
 * The negative half of {@link answering}: a search that found nothing is still
 * a search that has answered, and a step that asserts absence after one frame
 * is a step that reads the previous query's rows under load. Wait for
 * `data-asked`, then hold whatever the claim is.
 */
export const answered = async (
  world: OlaiWorld,
  panel: string,
  text: string,
): Promise<void> => {
  // ON the panel or INSIDE it: the shortlist and the palette list carry
  // `data-asked` on a child; the `@` completion carries it on the panel
  // itself. One locator, both shapes, so a door that publishes the
  // attribute cannot fail the wait for having put it one level out.
  const asked = attr("data-asked", text.trim());
  await world.page
    .locator(`${panel}${asked}, ${panel} ${asked}`)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
};
