import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { join } from "node:path"

const sources = (): ReadonlyArray<string> =>
  execFileSync("git", ["ls-files", "*.ts", "*.tsx"], {
    cwd: join(import.meta.dirname, ".."),
    encoding: "utf8",
  })
    .split("\n")
    .filter((path) => path !== "" && !path.includes(".test.") && !path.includes(".testlib."))

const OWNED: ReadonlyArray<{ readonly file: string; readonly held: string }> = [
  { file: "src/chat.ts", held: "`aside`, whose set `stopWithReason` interrupts" },
]

test("nothing in this plugin forks a fiber without an owner", () => {
  const found = sources().flatMap((path) => {
    const at = join(import.meta.dirname, "..", path)
    return readFileSync(at, "utf8")
      .split("\n")
      .flatMap((line, index) =>
        /Effect\.(forkDetach|runFork)\b/.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)
          ? [`${path}:${index + 1}`]
          : []
      )
  })
  expect(found.map((one) => one.split(":")[0]).sort()).toEqual(
    OWNED.map((one) => one.file).toSorted(),
  )
})
