/**
 * AN ODU SERVICE FOR ONE SCENARIO — spawned before the server that dials it.
 */

import { spawn } from "node:child_process"
import { once } from "node:events"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { createServer } from "node:net"

const FAKE = path.resolve(import.meta.dirname, "fake-service.ts")
const FIXTURES = path.resolve(import.meta.dirname, "fixtures")

export interface LiveOdu {
  readonly origin: string
  readonly fixture: string
  readonly stop: () => void
}

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (address === null || typeof address === "string") {
        server.close()
        reject(new Error("fake odu: expected a TCP address"))
        return
      }
      const port = address.port
      server.close(() => resolve(port))
    })
    server.on("error", reject)
  })

export const startOduService = async (fleet: string): Promise<LiveOdu> => {
  const port = await freePort()
  const dir = mkdtempSync(path.join(tmpdir(), "olai-odu-"))
  const fixture = path.join(dir, `${fleet}.json`)
  writeFileSync(fixture, readFixture(fleet))
  const child = spawn("bun", [FAKE, String(port), fixture], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  })
  child.stdout?.setEncoding("utf8")
  child.stderr?.setEncoding("utf8")
  let said = ""
  child.stderr?.on("data", (chunk: string) => {
    said += chunk
  })
  const origin = await new Promise<string>((resolve, reject) => {
    child.stdout?.on("data", (chunk: string) => {
      const match = /listening (\S+)/.exec(chunk)
      if (match?.[1] !== undefined) resolve(match[1])
    })
    void once(child, "exit").then(([code]) => {
      reject(new Error(`fake odu exited before listening (${String(code)}): ${said}`))
    })
  })
  return {
    origin,
    fixture,
    stop: () => {
      try {
        if (child.pid !== undefined) process.kill(-child.pid, "SIGTERM")
      } catch {
        child.kill("SIGTERM")
      }
    },
  }
}

const readFixture = (fleet: string): string => {
  try {
    return readFileSync(path.join(FIXTURES, `${fleet}.json`), "utf8")
  } catch {
    throw new Error(`fake odu: no fixture named ${fleet}`)
  }
}
