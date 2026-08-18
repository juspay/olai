/**
 * DRIVING A DRAG WITH THE MOUSE — press, travel, and the two places a gesture
 * can be asked what it promises.
 *
 * Here rather than in a step file because two features drive the same gesture:
 * dragging a row inside one pane (`dragdrop_multiselect.feature`) and dragging
 * one ACROSS two (`drag_across_panes.feature`). They are the same hand doing
 * the same thing — the second one merely starts and finishes in different
 * columns — so a second copy of "press the bullet, travel in steps, wait for
 * the affordance" would be a second answer to what a drag IS, and the two would
 * drift the day one of them was tuned.
 *
 * IT IS NOT PLAYWRIGHT'S `dragTo`. That helper drives HTML5 drag-and-drop,
 * which is the gesture this app deliberately does not use
 * (`web/src/client/drag/dragging.ts` says why): the drop target here is a GAP
 * between two lines and a DEPTH within it, computed from pointer coordinates.
 * So these press, travel and release, which is what a person's hand does.
 *
 * EVERYTHING TAKES A SCOPE, and that is what the second feature added. A row id
 * is unique in a SET but not on a SCREEN: two panes showing one file draw every
 * row of it twice, so "the bullet of `knobs`" is a question that needs to say
 * which pane before it has an answer. {@link everywhere} is the answer for a
 * lone page, and it is the whole page.
 */

import type { Locator } from "playwright";

import {
  DRAG_HANDLE,
  DROP_LINE,
  NODE_TITLE,
  nodeSelector,
  PANE,
  POLL_TIMEOUT,
} from "./world.ts";
import type { OlaiWorld } from "./world.ts";
import { attr } from "./selectors.ts";

/** How far in one level is drawn, near enough: the pointer only has to land
 *  closer to one step than to the next, and the client rounds. */
export const ONE_STEP = 40;

/** Where a row is looked for: the whole page. */
export const everywhere = (world: OlaiWorld): Locator => world.page.locator("body");

/** Where a row is looked for: ONE pane of a split, by its index. */
export const inPane = (world: OlaiWorld, index: number): Locator =>
  world.page.locator(`${PANE}${attr("data-pane", String(index))}`);

/** One row's own bullet-as-handle, inside a scope. `.first()` twice over: a
 *  descendant's row matches inside the scope too, and a descendant's handle
 *  inside the row — and the row's own is rendered before any child's. */
export const handleOf = (scope: Locator, id: string): Locator =>
  scope.locator(nodeSelector(id)).first().locator(DRAG_HANDLE).first();

/** One row's own title, inside a scope. Same rule, same reason. */
export const titleOf = (scope: Locator, id: string): Locator =>
  scope.locator(nodeSelector(id)).first().locator(NODE_TITLE).first();

/** Where a pointer is aimed, in the window's own coordinates. */
export interface At {
  readonly x: number;
  readonly y: number;
}

/** Just above a row's title: the gap between it and whatever is above it. */
export const aboveTitle = async (
  world: OlaiWorld,
  scope: Locator,
  id: string,
): Promise<At> => {
  const box = await world.box(titleOf(scope, id), `the title of "${id}"`);
  return { x: box.x + 4, y: box.y - 2 };
};

/** Just under a row's title, one level further in than that row is drawn. */
export const insideTitle = async (
  world: OlaiWorld,
  scope: Locator,
  id: string,
): Promise<At> => {
  const box = await world.box(titleOf(scope, id), `the title of "${id}"`);
  return { x: box.x + ONE_STEP, y: box.y + box.height + 2 };
};

/** The same gap, asked for as far in as the pointer can reach. What the client
 *  answers is then the deepest the gap ALLOWS, which is the assertion for a row
 *  nothing may hang under. */
export const farInside = async (
  world: OlaiWorld,
  scope: Locator,
  id: string,
): Promise<At> => {
  const box = await world.box(titleOf(scope, id), `the title of "${id}"`);
  return { x: box.x + box.width, y: box.y + box.height + 2 };
};

/** Put the pointer on a row's bullet and press. Answers with the box it landed
 *  on, because every gesture that starts here then travels somewhere measured
 *  from it. */
export const pressBullet = async (
  world: OlaiWorld,
  scope: Locator,
  id: string,
): Promise<{ x: number; y: number; width: number; height: number }> => {
  const box = await world.box(handleOf(scope, id), `the bullet of "${id}"`);
  await world.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await world.page.mouse.down();
  return box;
};

/**
 * Press the bullet and travel to a point, without letting go.
 *
 * The travel is in STEPS because the client only starts a drag once the pointer
 * has moved far enough to say it was not a click — one jump would arrive as a
 * single move and still work, but a scenario should exercise the gesture a hand
 * makes.
 *
 * `awaiting` is what the gesture is expected to PUT ON SCREEN, and it is a
 * parameter because a drag has two answers: the line where the row would land,
 * or the face saying the pane under the pointer cannot take it. Waiting for the
 * wrong one is a bare timeout; waiting for the right one is the assertion that
 * the affordance arrived at all.
 */
export const carry = async (
  world: OlaiWorld,
  scope: Locator,
  id: string,
  at: At,
  awaiting: string = DROP_LINE,
): Promise<void> => {
  await pressBullet(world, scope, id);
  await world.page.mouse.move(at.x, at.y, { steps: 12 });
  await world.page
    .locator(awaiting)
    .waitFor({ state: "attached", timeout: POLL_TIMEOUT });
};
