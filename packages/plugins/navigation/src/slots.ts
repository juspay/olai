/** Static extension contracts owned by the navigation capability. */
import type { JSX } from "solid-js"
import { slotContract, type SlotDefinition } from "@olai/plugin-api/slots"

export type AppRouteClaim =
  | { readonly kind: "exact"; readonly path: `/${string}` }
  | { readonly kind: "prefix"; readonly path: `/${string}` }

/** The grammar every plugin page shares, whoever draws it. */
export interface AppRouteGrammar {
  readonly claims: ReadonlyArray<AppRouteClaim>
  readonly parse: (pathname: string) => unknown | null
  readonly href: (page: unknown) => string
  readonly breadcrumb: (page: unknown) => string
  readonly narrowable: boolean
}

/** One plugin page as the slot carries it, ERASED: the grammar every page
 *  shares and a face whose props only the definer that built it knows. The
 *  only constructors are `./routes.ts`'s definers, a node page
 *  (`defineAppRoute`/`defineAppPage`) or a self-drawn one
 *  (`defineSelfDrawnRoute`/`defineSelfDrawnPage`), and which kind it is lives
 *  on the route they build. */
export interface AppPage {
  readonly route: AppRouteGrammar
  readonly face: (props: never) => JSX.Element
}

export interface AppPalette {
  readonly id: string
  readonly label: string
  readonly hint?: string
  readonly search: string
  readonly href: `/${string}`
}

export interface AppChord {
  /** The key, lowercase and as it reads without Shift — `j`, `.` — so one key
   *  has one spelling whether or not the chord holds Shift. */
  readonly key: string
  /** ...with Shift, for a chord whose bare form the browser has taken. */
  readonly shift?: boolean
  /** Whether it may fire while the caret is in a text field. A chord that means
   *  something about the PAGE rather than about the caret says `true`; one that
   *  claims a letter a draft means says `false`. */
  readonly whileEditing: boolean
  /** What it does, for the shortcut list — "show or hide the agent". */
  readonly said: string
  /** ...and what a press does. */
  readonly press: () => void
}

declare module "@olai/plugin-api/slots" {
  interface SlotDefinitions {
    "app.route": SlotDefinition<AppPage, "nothing">
    "app.keys": SlotDefinition<AppChord, "nothing">
    "app.palette": SlotDefinition<AppPalette, "nothing">
  }
}

export const slotContracts = {
  "app.route": slotContract<AppPage>("app.route","nothing",
    "A page built with navigation's own definers (`defineAppRoute` and `defineAppPage`, or `defineSelfDrawnRoute` and `defineSelfDrawnPage`, from `olai-plugin-navigation/routes`); any other value is refused, so a plugin that cannot import them cannot use this slot."),
  "app.keys": slotContract<AppChord>("app.keys","nothing",
    "A `{ key, shift?, whileEditing, said, press }`: `press` is called with nothing when `Cmd` (`Ctrl` elsewhere) and `key` are pressed, and `said` is its line in the shortcut list; a chord the app or an earlier plugin holds is not listened for."),
  "app.palette": slotContract<AppPalette>("app.palette","nothing",
    "A palette row `{ id, label, hint?, search, href }`, matched against what a person types and opening the address `href` when chosen."),
} as const
