import type { Meaning } from "@olai/format"

import type { Names } from "../names.ts"
import { propertyRoutes } from "../../index.ts"
import { readLocation } from "../locations.ts"
import { atNode, type Route } from "olai-plugin-navigation/routes"

export type Door =
  | (Drawn & { readonly kind: "document" | "node" | "day"; readonly route: Route })
  | (Drawn & { readonly kind: "away"; readonly href: string })

interface Drawn {
  readonly face: string
  readonly says: string
}

export function doorFor(opens: Extract<Meaning, { readonly kind: "node" | "away" }>, value: string, names: Names): Door
export function doorFor(opens: Meaning, value: string, names: Names, resolve?: (meaning: Meaning) => Route | undefined): Door | null
export function doorFor(opens: Meaning, value: string, names: Names,
  resolve: (meaning: Meaning) => Route | undefined = meaning => {
    for (const entry of readLocation(propertyRoutes)) { const route = entry.value(meaning); if (route !== undefined) return route }
    return undefined
  },
): Door | null {
  switch (opens.kind) {
    case "away":
      return { kind: "away", href: opens.href, says: opens.href, face: value }
    case "day":
      const route = resolve(opens)
      return route === undefined ? null : {
        kind: "day",
        route,
        says: `Open ${opens.date}`,
        face: value,
      }
    case "document": {
      const route = resolve(opens)
      return route === undefined ? null : { kind: "document", route, says: opens.file, face: value }
    }
    case "node": {
      const named = names(opens.id)
      return {
        kind: "node",
        route: atNode(opens.id),
        says: opens.titled ? opens.id : named?.title ?? opens.id,
        face: opens.titled ? named?.title ?? value : value,
      }
    }
  }
}
