/**
 * ODU'S HUE → OLAI'S INK. One table, and it is olai's own decision.
 *
 * odu names a status's colour by MEANING rather than by medium — `grey`,
 * `amber`, `green`, `red`, `violet` — precisely so each face maps it to its
 * own encoding: an ansi wrapper for a stream, a cell attribute for a grid
 * renderer, and this for a page. The assignment ("errored is violet") is made
 * once, upstream, and rendered many times; what a violet IS in this
 * stylesheet is not odu's business and never was.
 *
 * THE ONE INTERESTING ROW is `violet`. olai's palette has five inks and none
 * of them is violet, so `errored` — an infrastructure death, which odu keeps
 * apart from a test failure on purpose — takes the app's ACCENT rather than
 * its ALARM. That is the mapping doing its job rather than losing information:
 * a red node and an errored one are different things to go and do, so drawing
 * them in one ink would have thrown away the distinction odu maintains a
 * seventh status for.
 *
 * AN UNKNOWN HUE IS DRAWN, not normalised. odu is free to add a status and a
 * colour tomorrow, and this build compiled against a table that has never
 * heard of it — so the fallback is the quiet ink, and the status WORD is
 * beside it either way. A reader sees a strange state rather than a blank or a
 * lie, which is `@kolu/solid-dockrow`'s `narrowAgentState` rule read across
 * the other appliance.
 */

/** The ink for one node's hue — a Tailwind text colour off olai's own five. */
export const inkOf = (hue: string): string => INK[hue] ?? "text-muted"

const INK: Record<string, string> = {
  grey: "text-muted",
  amber: "text-doing",
  green: "text-done",
  red: "text-alarm",
  violet: "text-accent",
}
