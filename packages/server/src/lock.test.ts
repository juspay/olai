import { findLogfmt } from "@olai/log/testlib"
import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { BOOT_TIMEOUT, startWeb, type WebChild } from "./child.testlib.ts"
import { lockFor as lockPath, sweepRuntime as sweep } from "olai-plugin-vault/testlib"
import { runtimePaths } from "./runtime-paths.ts"
const lockFor = (root: string) => lockPath(root, runtimePaths)
const sweepRuntime = () => sweep(runtimePaths)
import { served } from "./serve.testlib.ts"

const BOUND_MS = BOOT_TIMEOUT * 4

const stopped = (child: WebChild, why: string): Promise<number | null> =>
  child.wait(BOOT_TIMEOUT, `${why} did not stop within ${BOOT_TIMEOUT}ms`)

const ours = process.env["XDG_RUNTIME_DIR"]
if (ours === undefined || !ours.includes("olai-test-run-")) {
  throw new Error(
    `lock tests need the process runtime dir from bun-test-preload, got ${ours}`,
  )
}
const env: NodeJS.ProcessEnv = { XDG_RUNTIME_DIR: ours }

test("a second olai serves its panel while the vault row refuses the held directory", async () => {
  const root = served()
  const first = startWeb({ root, env })
  try {
    await first.address()

    const second = startWeb({ root, env })
    await second.address()
    const response = await fetch(`${await second.address()}/mcp`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    })
    const tools = (await response.json()).result.tools.map((tool: { name: string }) => tool.name)
    expect(tools).not.toContain("outlines_title")
    expect(tools).not.toContain("outlines_read")
    await second.stop()

    expect(findLogfmt(second.said(), "serving")).toBeDefined()
  } finally {
    first.kill()
  }
}, BOUND_MS)

test("the refusal names the olai that holds the vault", async () => {
  const root = served()
  const first = startWeb({ root, env })
  try {
    await first.address()

    const second = startWeb({ root, env })
    await second.address()
    await second.stop()
    expect(second.said()).toContain(
      `another olai is serving this directory (pid ${first.pid})`,
    )
    expect(second.said()).toContain("one brain per vault")
  } finally {
    first.kill()
  }
}, BOUND_MS)

test("a stale pid in the note frees nothing, and is not read out as fact", async () => {
  const root = served()
  const first = startWeb({ root, env })
  try {
    await first.address()
    fs.writeFileSync(lockFor(root), `pid=${IMPOSSIBLE_PID}\n`, { mode: 0o600 })

    const second = startWeb({ root, env })
    await second.address()
    await second.stop()
    expect(second.said()).toContain("another olai is serving this directory")
    expect(second.said()).not.toContain(String(IMPOSSIBLE_PID))
  } finally {
    first.kill()
  }
}, BOUND_MS)

const IMPOSSIBLE_PID = 2_147_483_646

test("a symlinked spelling of the vault is the same vault", async () => {
  const root = fs.realpathSync(served())
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), "olai-lock-link-"))
  const link = path.join(elsewhere, "notes")
  fs.symlinkSync(root, link)

  const first = startWeb({ root, env })
  try {
    await first.address()

    const second = startWeb({ root: link, env })
    await second.address()
    await second.stop()
    expect(second.said()).toContain(
      `another olai is serving this directory (pid ${first.pid})`,
    )
  } finally {
    first.kill()
  }
}, BOUND_MS)

test("the holder is stopped and the directory is free", async () => {
  const root = served()
  const first = startWeb({ root, env })
  await first.address()
  first.kill("SIGINT")
  await stopped(first, "SIGINT")
  expect(fs.existsSync(lockFor(root))).toBe(false)

  const next = startWeb({ root, env })
  try {
    expect(await next.address()).toContain("http://127.0.0.1:")
  } finally {
    next.kill("SIGINT")
  }
}, BOUND_MS)

test("`kill -9` frees the directory: nothing was cleaned up, and nothing had to be", async () => {
  const root = served()
  const first = startWeb({ root, env })
  await first.address()
  first.kill("SIGKILL")
  await stopped(first, "SIGKILL")
  expect(fs.existsSync(lockFor(root))).toBe(true)

  const next = startWeb({ root, env })
  try {
    expect(await next.address()).toContain("http://127.0.0.1:")
    const note = fs.readFileSync(lockFor(root), "utf8")
    expect(note).toContain(`pid=${next.pid}`)
    expect(note).not.toContain(`pid=${first.pid}`)
  } finally {
    next.kill("SIGINT")
  }
}, BOUND_MS)

test("the lock is the directory's, however the directory was spelled", () => {
  const root = fs.realpathSync(served())
  const elsewhere = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-lock-key-")))
  const link = path.join(elsewhere, "notes")
  fs.symlinkSync(root, link)

  expect(lockFor(link)).toBe(lockFor(root))
  expect(lockFor(`${root}/.`)).toBe(lockFor(root))
  expect(lockFor(elsewhere)).not.toBe(lockFor(root))
}, BOUND_MS)

const refusedWithNoLock = async (runtimeDir: string): Promise<void> => {
  const child = startWeb({
    root: served(),
    env: { XDG_RUNTIME_DIR: runtimeDir },
  })
  try {
    await child.address()
    await child.stop()
    expect(child.said()).toContain("cannot take the one-brain lock")
    expect(findLogfmt(child.said(), "serving")).toBeDefined()
  } finally {
    child.kill()
  }
}

test("a runtime directory that is not a directory refuses the boot", async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "olai-lock-bad-")), "runtime")
  fs.writeFileSync(file, "not a directory\n", { mode: 0o600 })
  await refusedWithNoLock(file)
}, BOUND_MS)

test("a runtime directory other users can write refuses the boot", async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "olai-lock-open-"))
  fs.mkdirSync(path.join(runtime, "olai"), { mode: 0o755 })
  fs.chmodSync(path.join(runtime, "olai"), 0o755)
  await refusedWithNoLock(runtime)
}, BOUND_MS)

const placed = (name: string, body: string): string => {
  const dir = path.join(ours, "olai")
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  fs.chmodSync(dir, 0o700)
  const file = path.join(dir, name)
  fs.writeFileSync(file, body, { mode: 0o600 })
  return file
}

test("a dead-pid lock is swept", () => {
  const file = placed(
    "deadpiddeadpidde.lock",
    `pid=${IMPOSSIBLE_PID}\nroot=${ours}\n`,
  )
  expect(sweepRuntime()).toBeGreaterThanOrEqual(1)
  expect(fs.existsSync(file)).toBe(false)
}, BOUND_MS)

test("a live lock is not swept", async () => {
  const root = served()
  const server = startWeb({ root, env })
  await server.address()
  const leftover = placed(
    "leftoverleftoverl.lock",
    `pid=${IMPOSSIBLE_PID}\nroot=${ours}\n`,
  )
  try {
    expect(sweepRuntime()).toBeGreaterThanOrEqual(1)
    expect(fs.existsSync(leftover)).toBe(false)
    expect(fs.existsSync(lockFor(root))).toBe(true)
  } finally {
    server.kill("SIGINT")
    await stopped(server, "SIGINT")
  }
}, BOUND_MS)

test("a leftover whose recorded root is gone is swept when nothing holds it", () => {
  const file = placed(
    "missingrootmissi.lock",
    `pid=${process.pid}\nroot=/no/such/olai-vault-root\n`,
  )
  expect(sweepRuntime()).toBeGreaterThanOrEqual(1)
  expect(fs.existsSync(file)).toBe(false)
}, BOUND_MS)

test("a lock that is a symlink is not followed", () => {
  const target = path.join(ours, "secret")
  fs.writeFileSync(target, "do not touch\n", { mode: 0o600 })
  const file = placed("symlinksymlinksy.lock", "")
  fs.unlinkSync(file)
  fs.symlinkSync(target, file)
  sweepRuntime()
  expect(fs.readFileSync(target, "utf8")).toBe("do not touch\n")
  expect(fs.lstatSync(file).isSymbolicLink()).toBe(true)
}, BOUND_MS)

test("a leftover rendezvous socket is swept, and surface.sock is not", () => {
  const leftover = placed("0123456789abcdef.sock", "")
  const live = placed("surface.sock", "")
  expect(sweepRuntime()).toBeGreaterThanOrEqual(1)
  expect(fs.existsSync(leftover)).toBe(false)
  expect(fs.existsSync(live)).toBe(true)
  fs.unlinkSync(live)
}, BOUND_MS)


