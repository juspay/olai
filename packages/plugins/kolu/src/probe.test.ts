import { afterEach, expect, test } from "bun:test"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import { KOLU_COMMAND, KOLU_MCP_ARGS, PADI_SOCKET_ENV } from "olai-plugin-kolu/appliance/detect"
import { probe } from "./probe.ts"

const roots: string[] = []
const directory = () => {
  const root = mkdtempSync(join(tmpdir(), "olai-kolu-discovery-"))
  roots.push(root)
  return root
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

test("hands over an executable without starting it or checking its daemon", async () => {
  const root = directory()
  const marker = join(root, "started")
  const command = join(root, KOLU_COMMAND)
  writeFileSync(command, `#!/bin/sh\ntouch '${marker}'\nexit 1\n`)
  chmodSync(command, 0o755)
  expect(await probe({ PATH: root, [PADI_SOCKET_ENV]: "/missing/daemon.sock" })).toEqual({
    server: { name: KOLU_COMMAND, command, args: [...KOLU_MCP_ARGS],
      env: { [PADI_SOCKET_ENV]: "/missing/daemon.sock" } },
    missing: null,
  })
  expect(existsSync(marker)).toBe(false)
})

test("skips directories and nonexecutables, resolves afresh, and forwards only the supplied socket", async () => {
  const first = directory(), second = directory(), third = directory()
  mkdirSync(join(first, KOLU_COMMAND))
  writeFileSync(join(second, KOLU_COMMAND), "not executable", { mode: 0o644 })
  const command = join(third, KOLU_COMMAND)
  writeFileSync(command, "#!/bin/sh\nexit 1", { mode: 0o755 })
  const env = { PATH: [first, second, third].join(delimiter) }
  expect((await probe(env)).server).toMatchObject({ command, env: {} })
  rmSync(command)
  expect(await probe(env)).toEqual({ server: null, missing: null })
})

test("missing command is visible when a socket was explicitly configured", async () => {
  expect(await probe({ PATH: "" })).toEqual({ server: null, missing: null })
  expect((await probe({ PATH: "", [PADI_SOCKET_ENV]: "/expected.sock" })).missing)
    .toMatchObject({ name: KOLU_COMMAND, where: null })
})
