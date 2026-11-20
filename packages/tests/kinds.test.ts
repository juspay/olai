import { expect, test } from "bun:test"
import type { Claim } from "@olai/format"
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"
import { ROOT, read, tracked, withoutComments } from "./support/sweep.ts"

const sources = tracked(import.meta.filename)
  .filter(file => /\.tsx?$/.test(file))
  .map(file => ({ file, code: withoutComments(read(file)) }))

const independent = new Set([
  "packages/format/src/claims.testlib.ts",
  "packages/ops/src/claims.testlib.ts",
  "packages/surface/src/attach.ts",
  "packages/surface/src/attach.test.ts",
  "packages/plugins/chat/src/attachments.test.ts",
  "packages/tests/agent/scripted-acp.ts",
  "packages/plugins/chat/e2e/steps/chat_steps.ts",
  "packages/tests/support/docs.ts",
  "packages/tests/docs_lint.test.ts",
  "website/src/markdown.ts",
])

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

test("the suffix sweep reads the repository and the actual registrations", async () => {
  expect(sources.length).toBeGreaterThan(100)
  const naming = sources.filter(source => /^packages\/plugins\/[^/]+\/src\/server\.ts$/.test(source.file) && /\bFileKinds\b/.test(source.code))
  const registrations = naming.filter(source => /register\(claim\)/.test(source.code))
  expect(registrations.length).toBeGreaterThan(0)
  for (const reader of naming.filter(source => !registrations.includes(source))) {
    expect(reader.code).not.toMatch(/import\s*\{\s*claim\s*\}\s*from\s*["']\.\/claim\.ts["']/)
  }
  for (const server of registrations) {
    const row = server.file.slice(0, -"src/server.ts".length)
    const { claim } = await import(pathToFileURL(resolve(ROOT, row, "src/claim.ts")).href) as { claim: Omit<Claim, "kind"> }
    expect(server!.code).toMatch(/import\s*\{\s*claim\s*\}\s*from\s*["']\.\/claim\.ts["']/)
    for (const ext of claim.exts) {
      const spelled = new RegExp(`["']${escape(ext)}["']`)
      const owners = sources.filter(source => spelled.test(source.code))
      expect(owners.some(source => source.file === `${row}src/claim.ts`)).toBe(true)
      if (claim.under !== undefined) continue
      expect(owners.filter(source => !source.file.startsWith(row) && !independent.has(source.file)).map(source => source.file)).toEqual([])
    }
  }
})
