/**
 * WHAT THE PADI READOUT SAYS — the three faces of the link, as words.
 *
 * Beside the thing it reports on rather than in `../readout.ts`, which is that
 * module's own rule: a state's appearance is an argument about that state, and
 * the shared shape should not have to be edited to add a third readout.
 *
 * ## Why the header has this at all
 *
 * The dots already draw the link — a chip goes hollow when there is no padi.
 * But a per-chip hollow is AMBIGUOUS at a glance: it means "this terminal is
 * not in the fleet" and it means "there is no fleet", and a reader who is
 * looking at one lane cannot tell which from the dot alone. Worse, it makes
 * app health something you diagnose from whichever row happens to be on
 * screen — and on a page with no `terminal` property anywhere, from nothing at
 * all. So the link gets a chrome readout beside the connection pill, which is
 * where the other two standing promises about this page already are: that it
 * is still reading (`../connection/`), and that what is written to it is kept
 * (`../commit/`). This is the third: whether it can see the terminals.
 *
 * It is a SECOND READER of `cells.kolu` and adds nothing to the wire. The dots
 * consume the same cell through the fleet context; this one draws it directly.
 *
 * ## Quiet when connected, and present anyway
 *
 * `connected` is the state a reader should be able to stop looking at, so it
 * is the muted dot and one word. It is still DRAWN, for the connection pill's
 * reason: an indicator that appears only when something is wrong cannot be
 * trusted when it is absent, because "healthy" and "not rendered" look the
 * same.
 *
 * The SKEW face is the loud one, and deliberately: two builds that cannot
 * speak to each other is a fact somebody has to act on, it names both versions
 * so the reader knows which way to move, and nothing else on the page will
 * ever say it.
 */

import type { KoluLink } from "@olai/surface"

/**
 * WHAT THE READOUT SAYS, as its own shape.
 *
 * This used to be typed as `../readout.ts`'s `Look` — olai's chrome vocabulary,
 * imported by a file whose whole content is kolu's three link states. The type
 * is structurally identical and the import was harmless while both lived in one
 * package; it stops being harmless the moment this file is behind a wall,
 * because then a paragraph of kolu's words would be reaching back into the
 * app's design system for the noun it returns.
 *
 * So the words own their shape and the chrome accepts it. `Look` and this are
 * the same three fields by construction rather than by import, and the chrome
 * side (`./Padi.tsx`) is where the two meet — which is the right place, since
 * that is the file holding the pill, the dot geometry and the testid.
 */
export interface Said {
  /** The dot's COLOUR — a background utility. The dot's geometry is the
   *  chrome's (`../readout.ts`'s `DOT`); the two are concatenated at the call
   *  site, which is why this is a colour and not a class list. */
  readonly dot: string
  /** Two or three words, on screen next to the dot. */
  readonly label: string
  /** What that means, spelled out — the longer sentence a reader gets from the
   *  tip or the `title`, and the `aria-label` that keeps it from being
   *  hover-only. */
  readonly detail: string
}

/** One sentence about where olai looked, shared by the two arms that have
 *  nothing to report. Named once because the two differ in the WORD and not in
 *  the fact underneath. */
const lookedAt = (link: KoluLink): string =>
  link.socket === ""
    ? "this olai is not watching a padi at all."
    : link.told
    ? `${link.socket}, which is where $PADI_SOCKET points.`
    : `${link.socket}, the default rendezvous path.`

export const padiSaid = (link: KoluLink): Said => {
  switch (link.status) {
    case "connected":
      return {
        // The DONE green, the same one a finished task wears: this is the
        // quiet face, and the outline's own vocabulary is what keeps a second
        // green from meaning a second thing.
        dot: "bg-done",
        label: "kolu",
        detail:
          `connected to padi at ${link.socket} — the terminal rows on this page are live.`,
      }
    case "skew":
      return {
        dot: "bg-alarm",
        label: "kolu skew",
        detail:
          `padi at ${link.socket} speaks ${link.surfaceVersion ?? "?"} and this olai speaks ${link.speaks} — one of the two needs an upgrade, and until then no terminal can be read.`,
      }
    case "absent":
      return {
        dot: "bg-muted",
        label: "no kolu",
        detail: `no padi is answering at ${lookedAt(link)}`,
      }
  }
}
