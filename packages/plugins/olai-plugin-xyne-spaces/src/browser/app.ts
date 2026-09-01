/**
 * WHAT THIS PLUGIN READS OF THE APP — declared here, structurally.
 *
 * `@olai/plugin-api` imports THIS package, so importing it back would be a
 * cycle. The agreement is proved at the registry's `satisfies`.
 */

/** The chrome pill's look — classes rather than a component. */
export interface PillLook {
  readonly PILL: string
  readonly DOT: string
  readonly PILL_WARN_COAT: string
  readonly DOT_HOLLOW_WARN: string
  readonly TEXT_WARN: string
}

export interface SpacesApp {
  readonly desktop: () => boolean
  readonly pill: PillLook
}
