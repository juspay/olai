/** The public boot door is process location/face only; policy is authored. */
import { expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { served } from "./serve.testlib.ts"
const cli = (...args: string[]) => spawnSync(process.execPath, [new URL("./main.ts", import.meta.url).pathname, "web", ...args], { encoding: "utf8" })

test("web help declares exactly directory, host, port and profile", () => {
  const result = cli("--help")
  expect(result.status).toBe(0)
  expect(result.stdout).toContain("<directory>")
  const flags = result.stdout.split("\nFLAGS\n")[1]!.split("\nGLOBAL FLAGS")[0]!
  expect([...flags.matchAll(/--([a-z-]+)/g)].map(one => one[1]).sort()).toEqual(["host", "port", "profile"])
})

test("retired policy and row-selection flags are refused before serving", () => {
  for (const flag of ["--commit=auto", "--push=auto", "--no-commit", "--plugins=", "--extra-plugins=journal", "--without-plugins=chat", "--log-level=debug"]) {
    const result = cli(served(), flag)
    expect(result.status).not.toBe(0)
    expect(result.stdout + result.stderr).not.toContain('message="serving"')
    expect(result.stdout + result.stderr).toContain(flag.split("=")[0]!)
  }
}, 15000)
