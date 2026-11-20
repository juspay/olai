import type { Locator } from "playwright";

import {
  DRAG_HANDLE,
  DROP_LINE,
  NODE_TITLE,
  nodeSelector,
  POLL_TIMEOUT,
} from "./world.ts";
import type { OlaiWorld } from "./world.ts";

export const ONE_STEP = 40;

export const handleOf = (scope: Locator, id: string): Locator =>
  scope.locator(nodeSelector(id)).first().locator(DRAG_HANDLE).first();

export const titleOf = (scope: Locator, id: string): Locator =>
  scope.locator(nodeSelector(id)).first().locator(NODE_TITLE).first();

export interface At {
  readonly x: number;
  readonly y: number;
}

export const aboveTitle = async (
  world: OlaiWorld,
  scope: Locator,
  id: string,
): Promise<At> => {
  const box = await world.box(titleOf(scope, id), `the title of "${id}"`);
  return { x: box.x + 4, y: box.y - 2 };
};

export const insideTitle = async (
  world: OlaiWorld,
  scope: Locator,
  id: string,
): Promise<At> => {
  const box = await world.box(titleOf(scope, id), `the title of "${id}"`);
  return { x: box.x + ONE_STEP, y: box.y + box.height + 2 };
};

export const farInside = async (
  world: OlaiWorld,
  scope: Locator,
  id: string,
): Promise<At> => {
  const box = await world.box(titleOf(scope, id), `the title of "${id}"`);
  return { x: box.x + box.width, y: box.y + box.height + 2 };
};

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

export const carryPointer = async (world: OlaiWorld, from: At, to: At): Promise<void> => {
  await world.page.mouse.move(from.x, from.y);
  await world.page.mouse.down();
  await world.page.mouse.move(to.x, to.y, { steps: 12 });
};

export const aimAtVisible = async (world: OlaiWorld, target: Locator): Promise<void> => {
  const viewport = world.viewport();
  const box = await world.box(target, "carry destination");
  const center = box.y + box.height / 2;
  if (center < 100 || center > viewport.height - 60) {
    await world.page.mouse.move(box.x + box.width / 2, center < 100 ? 4 : viewport.height - 4, { steps: 12 });
    await world.waitUntil(async () => {
      const current = await target.boundingBox();
      if (!current) return false;
      const y = current.y + current.height / 2;
      return y >= 100 && y <= viewport.height - 60;
    }, "edge scrolling to reveal the carry destination");
  }
  const visible = await world.box(target, "visible carry destination");
  await world.page.mouse.move(visible.x + visible.width / 2, visible.y + visible.height / 2, { steps: 12 });
};
