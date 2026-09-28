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

import { recencyText } from "@kolu/solid-dockrow/rowValues"
import type { KoluLink, WatchPulse } from "olai-plugin-kolu/appliance/wire"

/**
 * THE BEAT'S REGISTER, in one word — the fold the pill paints itself with,
 * so the palette below (`../readout`'s own constants) is chosen ship-side,
 * not arbitrarily at the door.
 *
 * `none` is the face before the first stamp: not healthy and not loud, it
 * is merely EMPTY, and it must wear neither green's good conscience nor
 * amber's warning. Violet = an agent needs you; amber = something of this
 * machine's OWN is broken (the watcher's one register, alongside
 * `skulk`'s — NO other member's). The diamond answer on the door fold
 * is `kind`, not a second link-state: the link is the link.
 */
export interface Beat {
  readonly kind: "none" | "fresh" | "quiet"
  /** What the chip's inspection face says: `watcher pulse 2m ago` — or its
   *  long form, `watcher quiet 47m`, when the pulse HAS gone quiet. */
  readonly said: string | null
}

/**
 * The fold from a pulse stamp to the beat's register.
 *
 * The threshold is ARITHMETIC, and one line of it: the pulse is "quiet"
 * once the last beat is older than twice its cadence. The multiple is the
 * pill's margin — one window for the timer's own drift and one for the
 * wire between them, so a beat one window late does not paint amber on a
 * normal burn — and "from the config" is the `everyMs` the stamp rides
 * beside (`@olai/kolu-client`'s `KoluConfig`), so the pill need never guess
 * the vault's knobs.
 */
export const beatOf = (pulse: WatchPulse | null | undefined, now: number): Beat => {
  if (pulse === undefined || pulse === null) return { kind: "none", said: null }
  const at = new Date(pulse.at).getTime()
  const quiet = now - at > pulse.everyMs * 2
  // `age` folds differently the two ways: a fresh beat is a recency
  // ("watcher pulse 2m ago"); a quiet beat is A DEBT — the capsule, with
  // no `ago`, because what the register owes is an answer ("watcher quiet
  // 47m", the pill's loud words) and the longer phrase would blur it.
  const said = quiet
    ? `No check-in for ${recencyText("wait-chip", at, now)}`
    : `Checked in ${recencyText("ago", at, now)}`
  return { kind: quiet ? "quiet" : "fresh", said }
}

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
  /** How bad it is — ONE word, which the row's dot and the bar's health dot
   *  both read, so the two cannot disagree. The chrome's `BarTone` by
   *  structure rather than by import, for the wall reason above; the chrome
   *  owns what each word is painted. */
  readonly tone: "healthy" | "quiet" | "notice" | "alarm"
  /** Two or three words, on screen next to the dot. */
  readonly label: string
  /** What that means, spelled out — the longer sentence a reader gets from the
   *  tip or the `title`, and the `aria-label` that keeps it from being
   *  hover-only. */
  readonly detail: string
  /** The pulse's register, or `null` on the `skew`/`absent` faces: the
   *  link's own fault is what those fold-safe talk about, and the beat
   *  behind it is a dead horse nobody should beat. */
  readonly beat: Beat | null
}

/** One sentence about where olai looked, shared by the two arms that have
 *  nothing to report. Named once because the two differ in the WORD and not in
 *  the fact underneath. */
const lookedAt = (link: KoluLink): string =>
  link.socket === ""
    ? "kolu isn't set up"
    : link.told
    ? `kolu isn't running at ${link.socket} (from $PADI_SOCKET)`
    : `kolu isn't running at ${link.socket}`

export const padiSaid = (link: KoluLink, pulse?: WatchPulse | null, now?: number): Said => {
  switch (link.status) {
    case "connected": {
      // Either side absent — the wire unfed or the clock unpassed — is the
      // pre-beat face rather than a quiet beat read: never a lie by
      // arithmetic on a clock nobody asked for.
      const beat = pulse === undefined || now === undefined ? { kind: "none" as const, said: null } : beatOf(pulse, now)
      return {
        // Healthy — unless the watcher's pulse has gone quiet, which wants
        // attention and is not broken: the mirror is still connected.
        tone: beat.kind === "quiet" ? "notice" : "healthy",
        label: "kolu",
        detail: beat.said === null
          ? "Connected. Terminals on this page are live."
          : `Connected · ${beat.said}`,
        beat: beat.kind === "none" ? null : beat,
      }
    }
    case "skew":
      return {
        tone: "alarm",
        label: "kolu: update needed",
        detail:
          `kolu and olai versions don't match (padi ${link.surfaceVersion ?? "?"}, olai ${link.speaks}). Update one of them to see terminals.`,
        beat: null,
      }
    case "absent":
      return {
        tone: "quiet",
        label: "No kolu",
        detail: lookedAt(link),
        beat: null,
      }
  }
}
