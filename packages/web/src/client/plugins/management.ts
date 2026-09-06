/** One narrow adapter to the host's stable wire and browser coordinator. */
import { ROWS } from "@olai/bundle"
import { standing } from "@olai/plugin-api"
import { browserManagement, type BrowserManagement } from "@olai/surface/management"
import { app } from "./runtime.ts"

const looks = new Map(ROWS.map((row) => [row.id, {
  switchHint: row.switchHint,
  section: row.section,
  ...(row.quiet === true ? { quiet: true } : {}),
  ...(row.disabled === true ? { optIn: true } : {}),
}]))
export const supplyManagement = (management: Omit<BrowserManagement, "look">): Promise<void> =>
  standing()(app.supply(browserManagement, { ...management, look: (name) => looks.get(name) ?? {} }))
