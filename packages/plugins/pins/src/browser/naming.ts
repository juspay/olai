import { PIN_NAME_UNWRITABLE,pinTitle } from "@olai/format"
import type { Edit } from "@olai/surface"
import { Result } from "effect"

import type { Line } from "olai-plugin-navigation/palette-asking"
import { askInPalette } from "./box.ts"
import type { Route } from "olai-plugin-navigation/routes"
import type { Routing } from "olai-plugin-navigation/routes"
import type { Pin } from "./pins.ts"

export type Naming =
  | {
    readonly kind: "pin"
    readonly at: string
    readonly bare: string
  }
  | { readonly kind: "layout"; readonly at: string; readonly panes: string }
  | { readonly kind: "rename"; readonly pin: Pin }

export const askingFor = (naming: Naming): Line => ({
  kind: "line",
  label: naming.kind === "rename" ? "Rename" : "Pin",
  question: isLayout(naming) ? "Name this layout" : naming.kind === "pin"
    ? "Name this pin, or leave it blank"
    : "Rename this pin, or leave it blank",
  placeholder: naming.kind === "layout" ? naming.panes : naming.kind === "pin" ? naming.bare : naming.pin.bare,
  initial: naming.kind !== "rename" || !naming.pin.written ? "" : naming.pin.name,
  resolve: (name) => namedEdit(naming, name),
})

export const namedEdit = (
  naming: Naming,
  name: string,
): Result.Result<Edit, string> => {
  if (isLayout(naming) && name.trim() === "") return Result.fail("A layout needs a name")
  if (naming.kind !== "rename") {
    const named = name.trim()
    return Result.succeed(
      named === ""
        ? { verb: "pin", at: naming.at }
        : { verb: "pin", at: naming.at, name: named },
    )
  }
  const title = pinTitle(naming.pin.at, name)
  return title === undefined
    ? Result.fail(PIN_NAME_UNWRITABLE)
    : Result.succeed({ verb: "title", id: naming.pin.id, title, was: naming.pin.title, pinned: true })
}

export const namingFor = (
  routes: Routing,
  route: Route,
  already: Pin | undefined,
  bare: string,
): Naming | null =>
  routes.filterOf(route) !== "" && already === undefined
    ? { kind: "pin", at: routes.href(route), bare }
    : null

export const askName = (naming: Naming): void => askInPalette(askingFor(naming))

const isLayout = (naming: Naming): boolean => naming.kind === "layout"
  || (naming.kind === "rename" && naming.pin.target.kind === "layout")
