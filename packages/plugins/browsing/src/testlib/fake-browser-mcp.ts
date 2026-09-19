import { appendFileSync, existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { createInterface } from "node:readline"

// Independent protocol fixture: these names deliberately do not import the probe.
const names = ["browser_navigate", "browser_snapshot", "browser_click", "browser_type", "browser_take_screenshot"]
export const serveFake = (): void => {
  const runtime = process.env["XDG_RUNTIME_DIR"]
  const control = runtime && join(runtime, "browser-mode")
  const mode = process.env["FAKE_BROWSER_MODE"] ?? (control && existsSync(control) ? readFileSync(control, "utf8") : "good")
  if (runtime) appendFileSync(join(runtime, "browser-probes.log"), JSON.stringify({ args: process.argv.slice(2), pid: process.pid }) + "\n")
  if (mode === "garbage") { process.stdout.write("not MCP\n"); return }
  if (mode === "closed") return
  const lines = createInterface({ input: process.stdin })
  lines.on("line", line => {
    const message = JSON.parse(line)
    if (mode === "hang" || !message.id) return
    const result = message.method === "initialize"
      ? { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "fake-browser", version: "1" } }
      : { tools: (mode === "missing" ? names.slice(1) : names).map(name => ({ name, inputSchema: { type: "object", properties: {} } })) }
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }) + "\n")
  })
}
