/**
 * WHAT THIS PLUGIN READS OF THE APP — declared here, structurally, and declared
 * NARROW.
 *
 * The point of a re-declaration is that it names exactly what this plugin
 * spends: a face's parameter is contravariant, so the app's richer furniture
 * satisfies a narrower reading while a field asked for HERE that the app does
 * not hand over fails at the seam, naming this plugin. A re-declaration that
 * copies the app's whole shape gives that up and keeps only the cycle-avoidance.
 */

/** The chrome pill's look — the row's box and the dot's geometry. The dot's
 *  colour is the state's tone, painted from the layout contract's one table. */
export interface PillLook {
  readonly PILL: string
  readonly DOT: string
}

export interface SpacesApp {
  readonly desktop: () => boolean
  readonly pill: PillLook
}
