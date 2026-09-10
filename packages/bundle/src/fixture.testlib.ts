/** Test setup only: author the same policy file a person would put in a vault.
 * Existing authored leaves win, except an explicitly requested process log format. Call before the fixture's initial git commit,
 * never from product boot or when restarting an already prepared directory. */
import * as fs from "node:fs"
import * as path from "node:path"
import { ROWS } from "./rows.ts"

export interface FixturePolicy {
  readonly process?: Readonly<Record<string, string>>
  readonly commit?: string
  readonly push?: string
  readonly only?: string | ReadonlyArray<string>
  readonly extra?: string
  readonly without?: string
  readonly identity?: Readonly<Record<string, string | undefined>>
  readonly idle?: number
  readonly avatar?: string
}
export const writeFixturePolicy = (root: string, policy: FixturePolicy): void => {
  const file = path.join(root, "_olai/Settings.olai")
  type Node = { id: string; ord: string; title: string; parent?: string; custom?: Record<string, string> }
  let nodes: Node[] = []
  try { nodes = fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line)) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") return // Keep broken-file fixtures broken.
  }
  let changed = false
  const put = (name: string, key: string, value: string | undefined, replace = false) => {
    if (value === undefined) return
    let node = nodes.find(node => node.parent === undefined && node.title === name)
    if (node === undefined) {
      node = { id: `fixture-policy-${name}`, ord: `a${nodes.length.toString().padStart(4, "0")}`, title: name }
      nodes.push(node)
    }
    node.custom ??= {}
    if (!(key in node.custom) || (replace && node.custom[key] !== value)) { node.custom[key] = value; changed = true }
  }
  for (const [key, value] of Object.entries(policy.process ?? {})) put("olai", key, value, key === "log-format")
  put("git", "commit", policy.commit)
  put("git", "push", policy.push)
  if (policy.only !== undefined) {
    const names = typeof policy.only === "string" ? policy.only.split(",") : policy.only
    for (const row of ROWS) put(row.id, "on", names.includes(row.id) || (row.disabled !== true && row.profiles?.includes("test-minimal")) ? "yes" : "no")
  }
  for (const name of policy.extra?.split(",").filter(Boolean) ?? []) put(name, "on", "yes", true)
  for (const name of policy.without?.split(",").filter(Boolean) ?? []) put(name, "on", "no", true)
  for (const [key, value] of Object.entries(policy.identity ?? {})) put("identity", key, value)
  put("identity", "avatar-template", policy.avatar)
  put("chat", "idle-ms", policy.idle === undefined ? undefined : String(policy.idle))
  if (changed) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, nodes.map(node => JSON.stringify(node)).join("\n") + "\n")
  }
}

/** Exact row selection for isolated composition tests, never a product policy door. */
export const selectFixtureRows = (names: ReadonlyArray<string>) =>
  ROWS.map(row => ({ id: row.id, disabled: !names.includes(row.id) }))
