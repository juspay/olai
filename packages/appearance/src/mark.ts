/**
 * The palm-leaf mark as a square icon, in a palette.
 *
 * Paper is the ground, ink the stem and leaflets, done the soft washes. The
 * geometry is the original olai mark; only the colours move. `./chrome.ts`
 * paints this from whichever palette is in force; the files in `public/` are
 * the same drawing in one row, because an installer keeps a file.
 *
 * THE DOT is the same drawing with one thing added, and it is the tab's half
 * of the App Badging API: a browser that will not badge an app icon
 * (`../chat/attention/badge.ts` says which) still has a favicon, and this is
 * what "the agent is waiting on you" looks like there. It is drawn LARGE — a
 * favicon is sixteen pixels, so a dot at the scale it would have on a dock
 * icon is a smudge — and it is punched through the art on a ring of paper so
 * it reads as a mark on the icon rather than as one more leaflet.
 */

import type { Palette } from "./palettes.ts"

/** Where the dot sits and how big it is, in the mark's own 512 box: top-right,
 *  and about a third of the width across so it survives being drawn at 16px. */
const DOT = { x: 368, y: 144, ring: 128, r: 100 }

/** The mark, as an SVG document, in this palette — with the waiting dot on it
 *  when something is waiting on the reader. */
export const markSvg = (palette: Palette, waiting = false): string => {
  const { paper, ink, done, doing } = palette.colors
  const dot = waiting
    ? `
  <circle cx="${DOT.x}" cy="${DOT.y}" r="${DOT.ring}" fill="${paper}"/>
  <circle cx="${DOT.x}" cy="${DOT.y}" r="${DOT.r}" fill="${doing}"/>`
    : ""
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
  </g>${dot}
</svg>
`
}
