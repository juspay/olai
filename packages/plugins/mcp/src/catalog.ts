/** MCP's domain vocabulary is a projection of active capability declarations.
 * Shared discriminated procedures remain per-case capabilities: a Markdown
 * writer cannot keep outline operations advertised merely by sharing ops.run. */
import type { Tool } from "@olai/ops"
import type { TransportSurface } from "@olai/plugin-api/transport"

const reads: Readonly<Record<string, string>> = {
  list_outlines: "surface/ops/outlines",
  read_node: "surface/ops/node",
  read_subtree: "surface/ops/subtree",
  search_nodes: "surface/search/nodes",
  list_documents: "surface/ops/documents",
  read_document: "surface/ops/document",
}
const management: Readonly<Record<string, string>> = {
  inspect_plugins: "surface/plugins/inspect",
  run_plugin: "surface/plugins/run",
  stop_plugin: "surface/plugins/stop",
}

export const availableTools = (options: {
  readonly tools: ReadonlyArray<Tool>
  readonly current: TransportSurface["agent"]
  readonly ledger: () => boolean
}): ((name: string) => boolean) => {
  const tools = new Map(options.tools.map(tool => [tool.name, tool]))
  return name => {
    const bound = options.current()
    const has = (tag: string) => bound.expose.tags.has(tag) && tag in bound.handlers
    const hasCase = (tag: string, field: string, value: unknown) => {
      const dispatch = bound.dispatch?.[tag]
      return typeof value === "string" && dispatch?.field === field && dispatch.cases.includes(value)
    }
    const managed = management[name]
    if (managed) return has(managed)
    const tool = tools.get(name)
    if (!tool) return false
    if (tool.kind === "read") return reads[name] !== undefined && has(reads[name]!)
    if (tool.kind === "write") return has("surface/ops/run") && hasCase("surface/ops/run", "op", tool.fixed.op)
    if (tool.kind === "act") return options.ledger()
    // The plan resolves an inbox through paths and can either create it or add
    // to it. Its owning capture capability and each dependency must be active.
    return name === "capture" && hasCase("surface/edit/apply", "verb", "capture")
      && has("surface/ops/paths") && has("surface/ops/run")
      && hasCase("surface/ops/run", "op", "create") && hasCase("surface/ops/run", "op", "add")
  }
}
