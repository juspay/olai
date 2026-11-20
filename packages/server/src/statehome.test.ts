import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { BOOT_TIMEOUT, startWeb } from "./child.testlib.ts"
import { served } from "./serve.testlib.ts"

const writeRecord = (at: string, cwd: string): void => {
  fs.mkdirSync(path.dirname(at), { recursive: true, mode: 0o700 })
  fs.writeFileSync(
    at,
    JSON.stringify({ cwd, agent: "claude", session: "ses_wasmine" }) + "\n",
    { mode: 0o600 },
  )
}

const settled = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 500))

const until = async (predicate: () => boolean, timeout = 10_000): Promise<boolean> => {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (predicate()) return true
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return predicate()
}

// The enclosing test must outlive the child's startup deadline, the sweep
// observation window and shutdown. Bun's five-second default killed the child
// before its own ten-second boot deadline and produced an unhandled rejection.
const TEST_TIMEOUT = BOOT_TIMEOUT + 15_000

test("a spawned server never touches a state home it was not handed", async () => {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-fake-home-")))
  const byHome = path.join(home, ".local", "state", "olai", "chat", "deadd00ddeadd00d.json")
  writeRecord(byHome, path.join(home, "served-and-gone"))
  const harnesses = process.env["XDG_STATE_HOME"]
  if (harnesses === undefined || harnesses === "") {
    throw new Error("the preload did not hand this suite a state home")
  }
  const ambient = path.join(harnesses, "olai", "chat", "statehome-ambient.json")
  writeRecord(ambient, path.join(home, "ambient-served-and-gone"))
  const web = startWeb({ root: served(), env: { HOME: home } })
  try {
    await web.address()
    await settled()
  } finally {
    web.kill()
    await web.exited()
  }
  try {
    expect(fs.existsSync(byHome)).toBe(true)
    expect(fs.existsSync(ambient)).toBe(true)
  } finally {
    fs.rmSync(home, { recursive: true, force: true })
    fs.rmSync(ambient, { force: true })
  }
}, TEST_TIMEOUT)

test("a boot prunes the state home it was handed, once it is serving", async () => {
  const mine = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-state-home-")))
  const root = served()
  const dead = path.join(mine, "olai", "chat", "1gone1gone1gone1g.json")
  writeRecord(dead, path.join(mine, "served-and-gone"))
  const aboutRoot = path.join(mine, "olai", "chat", "a11vea11vea11vea.json")
  writeRecord(aboutRoot, root)
  const web = startWeb({ root, env: { XDG_STATE_HOME: mine } })
  try {
    await web.address()
    expect(await until(() => !fs.existsSync(dead))).toBe(true)
    expect(fs.existsSync(aboutRoot)).toBe(true)
  } finally {
    web.kill()
    await web.exited()
    fs.rmSync(mine, { recursive: true, force: true })
  }
}, TEST_TIMEOUT)
