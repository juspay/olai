/**
 * A BROWSER-ONLY ROW'S SLOTS, AS THE SERVE READS THEM — without the row's
 * browser entry ever being imported on the server.
 *
 * `vault-plugins_inspect` lists the slots it reads off `BundleModules`, and a
 * browser-only row (layout, sidebar, navigation, the plugins panel) is answered
 * there by a stub, because its entry is a browser graph the serve must never
 * evaluate (`./bundle.ts`'s `importByName`). Its slot contracts are a static
 * contract on the row's inert `./slots` door, and that door is what the read
 * hands over.
 *
 * IN A PROCESS OF ITS OWN, because the claim is about what got imported: every
 * test file `bun test` runs shares one module registry, so a neighbour that
 * imported a browser entry would make this pass or fail for a reason that is
 * not this read.
 */
import { expect, test } from "bun:test"
import * as path from "node:path"

const SCRIPT = `
import { Effect } from "effect"
import { BundleModules, openPlugins } from "@olai/plugin-api/services"
import { slotCatalog } from "@olai/plugin-api/slots"
import { mountBundle, offered } from "./bundle.ts"
import { selectFixtureRows } from "./fixture.testlib.ts"
import { ROWS } from "./rows.ts"

const modules = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const plugins = yield* openPlugins({ vars: {}, now: () => "2026-09-05T00:00:00Z" })
  yield* mountBundle(plugins.host, selectFixtureRows([]))
  return yield* offered(plugins.host, BundleModules)!.read
})))
const entries = ROWS.filter((row) => row.browserOnly).map((row) => {
  let entry = null
  try { entry = Bun.resolveSync(row.name + "/browser", import.meta.dir) } catch {}
  return { id: row.id, entry }
})
console.log(JSON.stringify({
  slots: Object.fromEntries(modules.map((one) => [one.name, slotCatalog([one.exports])])),
  imported: entries.filter((one) => one.entry !== null && one.entry in require.cache).map((one) => one.id),
  browserOnly: entries.map((one) => one.id),
}))
process.exit(0)
`

test("BundleModules answers a browser-only row's slots and never imports its browser entry", async () => {
  const run = Bun.spawn(["bun", "-e", SCRIPT], { cwd: path.join(import.meta.dir), stdout: "pipe", stderr: "pipe" })
  const [out, err, code] = await Promise.all([new Response(run.stdout).text(), new Response(run.stderr).text(), run.exited])
  expect({ code, err: code === 0 ? "" : err }).toEqual({ code: 0, err: "" })
  const line = out.trim().split("\n").at(-1) ?? "{}"
  const answer = JSON.parse(line) as {
    slots: Record<string, ReadonlyArray<{ name: string; keyedBy: string; handed: string }>>
    imported: ReadonlyArray<string>
    browserOnly: ReadonlyArray<string>
  }
  expect(answer.browserOnly.length).toBeGreaterThan(0)
  expect(answer.imported).toEqual([])
  const names = (row: string) => (answer.slots[row] ?? []).map((one) => one.name).sort()
  expect(names("layout")).toEqual(["app.banner", "app.header", "app.mount", "app.viewer"])
  expect(names("sidebar")).toEqual(["sidebar.entry", "sidebar.section"])
  expect(names("navigation")).toEqual(["app.command", "app.keys", "app.palette", "app.route", "file.page"])
  expect(names("plugin-inspector")).toEqual(["plugins.row"])
}, 60_000)
