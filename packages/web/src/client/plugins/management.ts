/** One narrow adapter to the host's stable wire and browser coordinator. */
import { ROWS } from "@olai/bundle"
import { standing } from "@olai/plugin-api"
import { browserManagement, type BrowserManagement } from "@olai/surface/management"
import { app } from "./runtime.ts"

const hints = new Map(ROWS.map((row) => [row.id, row.switchHint]))
export const supplyManagement = (management: Omit<BrowserManagement, "switchHint">): Promise<void> =>
  standing()(app.supply(browserManagement, { ...management, switchHint: (name) => hints.get(name) }))
