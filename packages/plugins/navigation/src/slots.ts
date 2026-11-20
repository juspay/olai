import type { JSX } from "solid-js"
import { slotContract, type SlotDefinition } from "@olai/plugin-api/slots"

export type AppRouteClaim =
  | { readonly kind: "exact"; readonly path: `/${string}` }
  | { readonly kind: "prefix"; readonly path: `/${string}` }

export interface AppRouteGrammar {
  readonly claims: ReadonlyArray<AppRouteClaim>
  readonly parse: (pathname: string) => unknown | null
  readonly href: (page: unknown) => string
  readonly breadcrumb: (page: unknown) => string
  readonly narrowable: boolean
}

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
  readonly key: string
  readonly shift?: boolean
  readonly whileEditing: boolean
  readonly said: string
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
  "app.route": slotContract<AppPage>("app.route","nothing"),
  "app.keys": slotContract<AppChord>("app.keys","nothing"),
  "app.palette": slotContract<AppPalette>("app.palette","nothing"),
} as const
