/**
 * WHAT THE PAGE PAINTS, read the way a person would see it — one spelling of
 * each question the layout scenarios ask about paint, so two steps cannot
 * disagree about what "drawn" means.
 *
 *   - {@link alphaOf}: how much of a computed colour shows, in every form a
 *     browser writes one;
 *   - {@link resolvedStyle}: what a theme token comes to in this page;
 *   - {@link opacityOf}: whether a control that waits for a pointer is drawn;
 *   - {@link pointAway}: a pointer resting over none of the page's controls.
 */

import type { Locator } from "playwright";

import type { OlaiWorld } from "./world.ts";

/** The alpha of a computed colour, 0 to 1: `transparent` is 0, `rgb(…)` 1,
 *  and `rgba(…, a)` or any function with a slash (`oklch(… / a)`,
 *  `color(srgb … / a%)`) what it says. */
export const alphaOf = (colour: string): number => {
  if (colour === "transparent") return 0;
  const slash = /\/\s*([\d.]+)(%?)\s*\)$/.exec(colour);
  if (slash !== null) return Number(slash[1]) / (slash[2] === "%" ? 100 : 1);
  const rgba = /^rgba\(.*,\s*([\d.]+)\s*\)$/.exec(colour);
  return rgba === null ? 1 : Number(rgba[1]);
};

/** A colour that paints something at all. */
export const painted = (colour: string): boolean => alphaOf(colour) > 0;

/** A colour nothing shows through. */
export const opaque = (colour: string): boolean => alphaOf(colour) >= 1;

/** One property as the page resolves it on a hidden probe carrying
 *  `declarations` — how a scenario learns what a token such as
 *  `var(--color-accent)` or `var(--height-header)` comes to here, rather than
 *  writing the value down. Add `forced-color-adjust:none` to read the sheet's
 *  own colour under a forced palette. */
export const resolvedStyle = (world: OlaiWorld, declarations: string, property: string): Promise<string> =>
  world.page.evaluate(([css, name]) => {
    const probe = document.createElement("div");
    probe.style.cssText = `position:absolute;visibility:hidden;${css}`;
    document.body.append(probe);
    const value = getComputedStyle(probe).getPropertyValue(name);
    probe.remove();
    return value;
  }, [declarations, property] as const);

/** A control's opacity, the claim for one that waits for a pointer: a
 *  transparent button is still one Playwright calls visible, and a thumb
 *  would land on it blindly. */
export const opacityOf = (control: Locator): Promise<string> =>
  control.evaluate((el) => getComputedStyle(el).opacity);

/** The pointer to the top-left corner: the app's name in the bar, which is
 *  not a control and is outside the sidebar, every pane and every page — so
 *  nothing it rests on is drawn for being pointed at. */
export const pointAway = async (world: OlaiWorld): Promise<void> => {
  await world.page.mouse.move(2, 2);
  await world.waitForFrame();
};
