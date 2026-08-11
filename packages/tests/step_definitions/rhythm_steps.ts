/**
 * The rendered markdown, held to the scale it declares.
 *
 * `@olai/web`'s `markdown/scale.ts` is the type and spacing scale — the closed
 * sets every element of a note or a document may draw a size, a gap, a pad and
 * a border from. The stylesheet is GENERATED from that table; this walks what
 * the browser actually laid out and asserts every element is on it.
 *
 * Why a browser test and not a unit test of the CSS: what an element ends up
 * set at is the whole cascade — a descendant rule, an inherited size, a
 * Tailwind preflight default, a utility a component happened to pass in. Only
 * the laid-out page knows. A `margin: 6px` added to a rule six months from now
 * is invisible in review, invisible in a diff of the sheet's own tokens, and
 * red here.
 *
 * It is deliberately a whole-page sweep rather than a list of elements to
 * check: the fixture (`fixtures/good/kitchen-sink.md`, and `catch-up`'s note)
 * is every mark the pipeline draws, so "every element under the block" is the
 * strongest form of the question and needs no maintenance when markdown grows
 * a new one.
 */

import * as assert from "node:assert";
import { Then } from "@cucumber/cucumber";

import {
  BORDER_PX,
  LEADING,
  PAD,
  RELATIVE,
  SPACE,
  TYPE,
  UNDER_TITLE,
} from "@olai/web/src/client/markdown/scale.ts";

import { HYDRATION_TIMEOUT } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** Every value the scale allows, in the units a computed style is read in.
 *  Assembled here rather than in the page, so what crosses into the browser is
 *  data and not this module. */
const allowed = {
  /** Absolute font sizes, in rem. A size not in here has to be inherited or a
   *  declared fraction of its parent — see `RELATIVE`. */
  sizeRem: [...new Set([...Object.values(TYPE), ...Object.values(UNDER_TITLE)])],
  /** The fractions that are allowed to be a fraction. */
  factors: Object.values(RELATIVE),
  marginRem: Object.values(SPACE),
  padRem: Object.values(PAD),
  leading: Object.values(LEADING),
  borderPx: Object.values(BORDER_PX),
};

/**
 * What is NOT swept, and why each is a rule rather than an exemption:
 *
 *   - `input[type=checkbox]` — a form control the browser sizes and fonts
 *     itself; the sheet sets its box and its pull-back margin, which are about
 *     the marker slot rather than about type.
 *   - `.sr-only` — visually hidden, and hidden by a `-1px` margin that IS the
 *     technique. A scale value there would defeat it.
 *   - `img` — a picture is whatever size somebody saved it at.
 *   - `sup`/`sub` — the preflight's, and `RELATIVE.sup` says so; their own
 *     `line-height: 0` is in `LEADING` for the same reason.
 */
const SKIP = 'input, .sr-only, img, sup, [class*="hljs"]';

interface Offence {
  readonly element: string;
  readonly property: string;
  readonly value: string;
}

Then(
  "every rendered element is on the markdown scale",
  async function (this: OlaiWorld, ) {
    const block = this.page.locator(".olai-md").first();
    await block.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });

    const offences: Offence[] = await block.evaluate((root, sets) => {
      const rootSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const px = (rem: number): number => rem * rootSize;
      // Laid-out values are floats (a 0.875rem heading is 14px, a 1.125rem one
      // 18px, but a percentage of either can land on 17.5). Compared at 0.05px,
      // which is finer than any scale step and coarser than float noise.
      const near = (value: number, wanted: number): boolean => Math.abs(value - wanted) < 0.05;
      const oneOfRem = (value: number, rems: number[]): boolean =>
        rems.some((rem) => near(value, px(rem)));

      const found: { element: string; property: string; value: string }[] = [];
      const name = (node: Element): string => {
        const classes = typeof node.className === "string" && node.className.trim() !== ""
          ? "." + node.className.trim().split(/\s+/).join(".")
          : "";
        return `${node.tagName.toLowerCase()}${classes}`;
      };

      for (const node of [root, ...root.querySelectorAll("*")]) {
        if (node !== root && node.matches(sets.skip)) continue;
        const style = getComputedStyle(node);
        const size = Number.parseFloat(style.fontSize);
        const parent = node.parentElement;
        const parentSize = parent === null
          ? size
          : Number.parseFloat(getComputedStyle(parent).fontSize);
        const complain = (property: string, value: string) =>
          found.push({ element: name(node), property, value });

        // A size is on the scale, inherited from its parent, or a declared
        // fraction of it. Three answers, and every element of prose is one of
        // them.
        if (
          !oneOfRem(size, sets.sizeRem) &&
          !near(size, parentSize) &&
          !sets.factors.some((factor: number) => near(size, parentSize * factor))
        ) {
          complain("font-size", style.fontSize);
        }

        // Leading is a RATIO of the element's own size, which is what makes it
        // one number across six heading sizes.
        const leading = style.lineHeight === "normal" ? null : Number.parseFloat(style.lineHeight);
        if (leading !== null && !sets.leading.some((ratio: number) => near(leading / size, ratio))) {
          complain("line-height", `${style.lineHeight} (${(leading / size).toFixed(3)}×)`);
        }

        for (const side of ["marginTop", "marginBottom"] as const) {
          const value = Number.parseFloat(style[side]);
          if (!oneOfRem(value, sets.marginRem)) complain(side, style[side]);
        }
        for (
          const side of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const
        ) {
          const value = Number.parseFloat(style[side]);
          if (!oneOfRem(value, sets.padRem)) complain(side, style[side]);
        }
        for (
          const side of [
            "borderTopWidth",
            "borderRightWidth",
            "borderBottomWidth",
            "borderLeftWidth",
          ] as const
        ) {
          const value = Number.parseFloat(style[side]);
          if (!sets.borderPx.some((width: number) => near(value, width))) {
            complain(side, style[side]);
          }
        }
      }
      return found;
    }, { ...allowed, skip: SKIP });

    assert.deepStrictEqual(
      offences,
      [],
      `${offences.length} value(s) off the declared scale ` +
        `(packages/web/src/client/markdown/scale.ts):\n  ` +
        offences.map((one) => `${one.element} ${one.property}: ${one.value}`).join("\n  "),
    );
  },
);
