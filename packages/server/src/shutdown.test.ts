import { expect, test } from "bun:test"
import { spawn } from "node:child_process"

import { startWeb } from "./child.testlib.ts"
import { served } from "./serve.testlib.ts"

const BOUND_MS = 10_000

const signaled = async (signal: "SIGINT" | "SIGTERM"): Promise<{
  readonly code: number | null
  readonly said: string
}> => {
  const server = startWeb({ root: served() })
  try {
    const url = await server.address()
    const socket = new WebSocket(`${url.replace("http://", "ws://")}/rpc/ws`)
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve())
      socket.addEventListener("error", () => reject(new Error("the socket did not open")))
    })

    server.kill(signal)
    const code = await Promise.race([
      server.exited(),
      Bun.sleep(BOUND_MS).then(() => {
        throw new Error(`${signal} did not stop the child within ${BOUND_MS}ms`)
      }),
    ])
    return { code, said: server.said() }
  } finally {
    server.kill()
  }
}

test("SIGINT stops a server that a browser is connected to", async () => {
  const { code, said } = await signaled("SIGINT")
  expect(code).toBe(130)
  expect(said).toContain("olai web: received SIGINT")
}, BOUND_MS * 3)

test("SIGTERM names itself on stderr and exits 130", async () => {
  const { code, said } = await signaled("SIGTERM")
  expect(code).toBe(130)
  expect(said).toContain("olai web: received SIGTERM")
}, BOUND_MS * 3)

const until = async (ms: number, what: string, predicate: () => boolean): Promise<void> => {
  const deadline = Date.now() + ms
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`${what} never happened within ${ms}ms`)
    await Bun.sleep(20)
  }
}

const firstLineOf = (proc: ReturnType<typeof spawn>): Promise<string> =>
  new Promise((resolve, reject) => {
    let box = ""
    proc.stdout?.setEncoding("utf8")
    proc.stdout?.on("data", (chunk: string) => {
      box += chunk
      const breakAt = box.indexOf("\n")
      if (breakAt >= 0) resolve(box.slice(0, breakAt).trim())
    })
    proc.on("exit", (code) => reject(new Error(`helper exited (${code}) without a pid line; it said: ${box}`)))
  })

test("a SIGTERM from anyone but the supervisor is refused and named; the server keeps serving", async () => {
  // The guard is Linux-only (the supervisor it recognizes is systemd's
  // user manager); everywhere else keeps the default disposition.
  if (process.platform !== "linux") return
  const server = startWeb({ root: served() })
  try {
    const url = await server.address()
    const pid = server.pid
    expect(pid).toBeGreaterThan(0)

    await until(BOUND_MS, "the guard arming", () => server.said().includes("SIGTERM guard armed"))

    const stranger = spawn("bash", ["-c", `echo $$; kill -TERM ${pid}; sleep 1 & wait`], {
      stdio: ["ignore", "pipe", "inherit"],
    })
    const strangerPid = Number(await firstLineOf(stranger))
    expect(strangerPid).toBeGreaterThan(0)
    expect(strangerPid).not.toBe(pid)

    await until(
      BOUND_MS,
      `the refusal of the stranger's TERM (said so far:\n${server.said()})`,
      () => server.said().includes(`refused SIGTERM from pid ${strangerPid} uid ${process.getuid?.()}`),
    )
    expect(server.said()).toContain("(bash -c")

    const page = await fetch(url)
    expect(page.status).toBe(200)
    expect(process.kill(pid as number, 0)).toBe(true)

    server.kill("SIGTERM")
    const code = await Promise.race([
      server.exited(),
      Bun.sleep(BOUND_MS).then(() => {
        throw new Error(`the supervisor's TERM did not stop the child within ${BOUND_MS}ms`)
      }),
    ])
    expect(code).toBe(130)
    expect(server.said()).toContain("honoring SIGTERM")
    expect(server.said()).toContain("olai web: received SIGTERM")
  } finally {
    server.kill()
  }
}, BOUND_MS * 4)

