import { scopedToolName } from "@kolu/surface-mcp"
import type { Tool } from "@olai/ops"
import type { Catalogue } from "./contract.ts"

/** No generation is retained: withdrawal and replacement are read per call. */
export const advertisedFrom = (serverName: string, rows: () => ReadonlyArray<{ readonly name: string; readonly tools: ReadonlyArray<unknown> }>): Catalogue["advertised"] =>
  (server, tool) => {
    if (server !== serverName) return null
    for (const row of rows()) {
      for (const entry of row.tools as ReadonlyArray<Tool>) {
        if (scopedToolName(row.name, entry.name) === tool) return { title: entry.title, owner: row.name }
      }
    }
    return null
  }
