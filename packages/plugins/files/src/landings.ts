import { heldService } from "@olai/ui-primitives/held.ts"
import { scopedLandings, type Landings } from "@olai/plugin-api/carry"
const held = heldService<Landings>()
export const landings = held.read
export const holdLandings = (table: Landings) => {
  const scope = scopedLandings(table)
  const release = held.hold(scope)
  return () => { scope.dispose(); release() }
}
