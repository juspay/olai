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

/** The chrome pill's look — classes rather than a component. FIVE, because the
 *  pill spaces draws is either plain or alarmed: it has no warn arm, and copied
 *  the app's three WARN tokens for a while without a line reading one. kolu's
 *  own `PillLook` one appliance over is the mirror image — the two plain
 *  tokens and the three WARN, and no ALARM — which is what this shape looks
 *  like when each half declares its own. */
export interface PillLook {
  readonly PILL: string
  readonly DOT: string
  readonly PILL_ALARM_COAT: string
  readonly DOT_HOLLOW_ALARM: string
  readonly TEXT_ALARM: string
}

export interface SpacesApp {
  readonly desktop: () => boolean
  readonly pill: PillLook
}
