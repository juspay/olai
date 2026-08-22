/**
 * The palm-leaf mark as a square icon, in a palette.
 *
 * Paper is the ground, ink the stem and leaflets, done the soft washes — the
 * three tokens the install files already spent. A fourth would be a drawing
 * that is not this drawing. The geometry is the original olai mark; only the
 * colours move.
 *
 * The files in `public/` are this drawing in one palette, because an installer
 * and a home screen keep a file. The TAB is not those files: `./chrome.ts`
 * paints this from whichever palette is in force, the same way it paints
 * `theme-color`.
 */

import type { Palette } from "./palettes.ts"

/** The mark, as an SVG document, in this palette. */
export const markSvg = (palette: Palette): string => {
  const { paper, ink, done } = palette.colors
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="olai">
  <rect width="512" height="512" rx="92" fill="${paper}"/>
  <g fill="none" stroke="${ink}" stroke-linecap="round" stroke-linejoin="round">
    <path stroke-width="18" d="M256 420 V118"/>
    <path stroke-width="14" d="M256 150 C210 130 165 120 130 128"/>
    <path stroke-width="14" d="M256 150 C302 130 347 120 382 128"/>
    <path stroke-width="15" d="M256 205 C200 180 148 168 108 178"/>
    <path stroke-width="15" d="M256 205 C312 180 364 168 404 178"/>
    <path stroke-width="16" d="M256 265 C192 238 132 228 88 240"/>
    <path stroke-width="16" d="M256 265 C320 238 380 228 424 240"/>
    <path stroke-width="15" d="M256 325 C200 302 148 296 110 310"/>
    <path stroke-width="15" d="M256 325 C312 302 364 296 402 310"/>
    <path stroke-width="14" d="M256 375 C214 360 178 358 150 370"/>
    <path stroke-width="14" d="M256 375 C298 360 334 358 362 370"/>
  </g>
  <g fill="${done}" opacity="0.18">
    <ellipse cx="175" cy="155" rx="58" ry="22" transform="rotate(-18 175 155)"/>
    <ellipse cx="337" cy="155" rx="58" ry="22" transform="rotate(18 337 155)"/>
    <ellipse cx="155" cy="210" rx="68" ry="26" transform="rotate(-16 155 210)"/>
    <ellipse cx="357" cy="210" rx="68" ry="26" transform="rotate(16 357 210)"/>
    <ellipse cx="145" cy="270" rx="74" ry="28" transform="rotate(-12 145 270)"/>
    <ellipse cx="367" cy="270" rx="74" ry="28" transform="rotate(12 367 270)"/>
    <ellipse cx="160" cy="328" rx="62" ry="24" transform="rotate(-10 160 328)"/>
    <ellipse cx="352" cy="328" rx="62" ry="24" transform="rotate(10 352 328)"/>
    <ellipse cx="185" cy="378" rx="48" ry="18" transform="rotate(-8 185 378)"/>
    <ellipse cx="327" cy="378" rx="48" ry="18" transform="rotate(8 327 378)"/>
  </g>
</svg>
`
}
