/** Static extension contracts owned by the navigation capability. */
import type { JSX } from "solid-js"
import { slotContract, type SlotDefinition } from "@olai/plugin-api/slots"

export interface AppPageAnswer {
  (): unknown | undefined
  readonly changed?: (handler: () => void) => () => void
}

export interface AppPageStream {
  readonly use: (input: () => unknown | null) => AppPageAnswer
}

export type AppRouteClaim =
  | { readonly kind: "exact"; readonly path: `/${string}` }
  | { readonly kind: "prefix"; readonly path: `/${string}` }

export interface AppRoute {
  readonly claims: ReadonlyArray<AppRouteClaim>
  readonly parse: (pathname: string) => unknown | null
  readonly href: (page: unknown) => string
  readonly breadcrumb: (page: unknown) => string
  readonly narrowable: boolean
  readonly request: (page: unknown, today: string) => unknown
  readonly stream: AppPageStream
}

export interface AppPage {
  readonly route: AppRoute
  readonly face: (props: {
    readonly page: unknown
    readonly drawn: unknown
    readonly today: string
  }) => JSX.Element
}

export interface AppPalette {
  readonly id: string
  readonly label: string
  readonly hint?: string
  readonly search: string
  readonly href: `/${string}`
}

export interface AppChord {
  /** The letter, lowercase — `j`. */
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

export interface AppCommand {
  /** The character that selects it — `>`. */
  readonly prefix: string
  /** The words for the prefix strip. */
  readonly said: string
  /** ...and the placeholder in the box once the prefix is typed. */
  readonly placeholder: string
  /** What a press does with the line. `null` is "it landed"; a string is the
   *  refusal, in the plugin’s own words, drawn where the palette draws one. */
  readonly run: (line: string) => Promise<string | null>
}

declare module "@olai/plugin-api/slots" {
  interface SlotDefinitions {
    "app.route": SlotDefinition<AppPage, "nothing">
    "app.keys": SlotDefinition<AppChord, "nothing">
    "app.command": SlotDefinition<AppCommand, "nothing">
    "app.palette": SlotDefinition<AppPalette, "nothing">
  }
}

export const slotContracts = {
  "app.route": slotContract<AppPage>("app.route","nothing"),
  "app.keys": slotContract<AppChord>("app.keys","nothing"),
  "app.command": slotContract<AppCommand>("app.command","nothing"),
  "app.palette": slotContract<AppPalette>("app.palette","nothing"),
} as const
