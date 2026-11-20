import { existsSync, readdirSync } from "node:fs"
import * as path from "node:path"

import { ROWS } from "../packages/bundle/src/rows.ts"
import { dependencyNames, manifestOf, MEMBER_OF_PACKAGE, REPO } from "../packages/bundle/src/tree.testlib.ts"

const at = (member: string): string => path.join("packages", member)
const holds = (dir: string, entry: string): boolean => existsSync(path.join(REPO, dir, entry))

const refuse = (said: string): never => {
  console.error(`fence-tree: ${said}`)
  process.exit(1)
}

const tenants = ROWS.flatMap((row) => {
  const name = `olai-plugin-${row.id}`
  const member = MEMBER_OF_PACKAGE.get(name)
  return member === undefined ? [] : [{ name, dir: at(member) }]
})
if (tenants.length < 2) refuse("fewer than two rows of the registry are workspace members")

const registries = [...MEMBER_OF_PACKAGE].flatMap(([name, member]) => {
  const dir = at(member)
  if (!holds(dir, "src/fence.test.ts")) return []
  const declared = dependencyNames(manifestOf(member))
  return declared.some((dep) => tenants.some((tenant) => tenant.name === dep)) ? [{ name, dir }] : []
})
if (registries.length !== 1) {
  refuse(`${registries.length} members hold src/fence.test.ts and declare a row: ${registries.map((one) => one.dir).join(", ")}`)
}
const registry = registries[0]!

const containers = [...new Set(tenants.map((tenant) => path.dirname(tenant.dir)))]
if (containers.length !== 1) refuse(`the rows do not share one container: ${containers.join(", ")}`)
const container = containers[0]!

const halved = tenants
  .filter((tenant) => holds(tenant.dir, "src/server.ts") && holds(tenant.dir, "src/browser.tsx"))
  .sort((one, other) => (one.dir < other.dir ? -1 : 1))
if (halved.length < 2) refuse("fewer than two rows have both a server and a browser half")
const [a, b] = halved as [{ name: string; dir: string }, { name: string; dir: string }]

const composer = tenants.find((tenant) => holds(tenant.dir, "src/wire.ts"))
if (composer === undefined) refuse("no row composes a sibling surface")

const componentsUnder = (dir: string): ReadonlyArray<string> => {
  const found: string[] = []
  const walk = (here: string): void => {
    for (const entry of readdirSync(path.join(REPO, here), { withFileTypes: true }).sort((one, other) => (one.name < other.name ? -1 : 1))) {
      const next = path.join(here, entry.name)
      if (entry.isDirectory()) walk(next)
      else if (entry.name.endsWith(".tsx")) found.push(next)
    }
  }
  walk(path.join(dir, "src"))
  return found
}
const component = componentsUnder(b.dir)[0]
if (component === undefined) refuse(`${b.dir} has no component to mutate`)

const roster: ReadonlyArray<readonly [string, string]> = [
  ["registry", registry.dir],
  ["registry_name", registry.name],
  ["container", container],
  ["plugin_a", a.dir],
  ["name_a", a.name],
  ["plugin_b", b.dir],
  ["name_b", b.name],
  ["tenant_a", composer!.dir],
  ["component_b", component!],
  ["component_b_spec", `./${path.relative(path.join(b.dir, "src"), component!)}`],
]
for (const [key, value] of roster) console.log(`${key}\t${value}`)
