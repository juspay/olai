/** Registered suffixes belong to their claiming rows. Prose and complete
 * filenames are not suffix decisions; bare suffix string literals are. */
import { expect, test } from "bun:test"
import { TEST_CLAIMS } from "@olai/format/testlib"
import { read, tracked, withoutComments } from "./support/sweep.ts"

const sources = tracked(import.meta.filename)
  .filter(file => /\.tsx?$/.test(file))
  .map(file => ({ file, code: withoutComments(read(file)) }))

/** These answer what an agent may receive, independently of what the vault
 * serves. The fake agent is a third-party peer; the steps provide its bytes. */
const independent = new Set([
  "packages/surface/src/attach.ts",
  "packages/surface/src/attach.test.ts",
  "packages/plugins/chat/src/attachments.test.ts",
  "packages/tests/agent/fake-acp-agent.ts",
  "packages/tests/step_definitions/chat_steps.ts",
])

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

test("the suffix sweep reads the repository and the actual registrations", () => {
  expect(sources.length).toBeGreaterThan(100)
  expect(TEST_CLAIMS.byKind.size).toBeGreaterThan(0)
  for (const claim of TEST_CLAIMS.byKind.values()) {
    const row = `packages/plugins/${claim.kind}/`
    const server = sources.find(source => source.file === `${row}src/server.ts`)
    expect(server).toBeDefined()
    // Follow the row's registration to its inert claim module. No second
    // roster of suffixes or allowed server filenames lives in this sweep.
    expect(server!.code).toMatch(/register\(claim\)/)
    expect(server!.code).toMatch(/import\s*\{\s*claim\s*\}\s*from\s*["']\.\/claim\.ts["']/)
    for (const ext of claim.exts) {
      const spelled = new RegExp(`["']${escape(ext)}["']`)
      const owners = sources.filter(source => spelled.test(source.code))
      expect(owners.some(source => source.file === `${row}src/claim.ts`)).toBe(true)
      expect(owners.filter(source => !source.file.startsWith(row) && !independent.has(source.file)).map(source => source.file)).toEqual([])
    }
  }
})
