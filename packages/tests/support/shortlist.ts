import { attr, POLL_TIMEOUT } from "./world.ts";
import type { OlaiWorld } from "./world.ts";

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

export const answered = async (
  world: OlaiWorld,
  panel: string,
  text: string,
): Promise<void> => {
  const asked = attr("data-asked", text.trim());
  await world.page
    .locator(`${panel}${asked}, ${panel} ${asked}`)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
};
