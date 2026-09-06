/** Stable DOM identifiers owned by this renderer. Shared consumers import
 * this static contract; no provider state or activation is loaded with it. */
export const TESTID = {
  props: "props",
  prop: "prop",
  propValue: "prop-value",
  progress: "progress",
  tip: "tip",
  prefsRow: "prefs-row",
  prefsHint: "prefs-hint",
  prefsChoice: "prefs-choice",
  prefsSetBy: "prefs-set-by",
  nothing: "nothing",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

/** Each renderer augments this type-only registry from its own static door.
 * Shared widgets accept known literal IDs without importing a bundle catalogue. */
export interface TestIdTables { readonly primitives: typeof TESTID }
type Values<T> = T extends unknown ? T[keyof T] : never
export type AnyTestId = Values<TestIdTables[keyof TestIdTables]>
export const selector = (id: AnyTestId): string => `[data-testid="${id}"]`
