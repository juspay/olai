import { Schema } from "effect"

export const App = Schema.Struct({
  hostname: Schema.String,
  startedAt: Schema.String,
})
export type App = typeof App.Type

export const appName = (hostname: string): string => `olai [${hostname}]`
