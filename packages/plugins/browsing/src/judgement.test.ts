import { expect, test } from "bun:test"
import type { Verdict } from "@olai/plugin-kit/stdio-mcp"
import { REQUIRED_TOOLS, whyOf } from "./probe.ts"

const compatible: Verdict = {
  _tag: "answered", stderr: "",
  tools: REQUIRED_TOOLS.map(name => ({ name, inputs: [] })),
}

test("only the promised tools matter to compatibility", () => {
  expect(whyOf(compatible)).toBeNull()
  expect(whyOf({ ...compatible, tools: [...compatible.tools, { name: "future", inputs: [] }] })).toBeNull()
  expect(whyOf({ ...compatible, tools: compatible.tools.slice(1) })).toBe(
    "Browser tools need a compatible Playwright MCP build; its tool list is missing browser_navigate.",
  )
})

test.each([
  [{ _tag: "couldNotStart", cause: "permission denied", stderr: "" }, "Browser tools could not start: permission denied."],
  [{ _tag: "timedOut", deadlineMs: 5000, stderr: "" }, "Browser tools did not answer MCP within 5 seconds."],
  [{ _tag: "closed", stderr: "" }, "Browser tools closed the MCP connection without answering."],
  [{ _tag: "failed", cause: "bad frame", stderr: "" }, "Browser tools did not speak the expected MCP protocol: bad frame."],
] satisfies Array<[Verdict, string]>)("judges %j without starting a subprocess", (verdict, sentence) => {
  expect(whyOf(verdict)).toBe(sentence)
  expect(whyOf({ ...verdict, stderr: "  diagnostic\n" })).toBe(`${sentence} Executable stderr: diagnostic`)
})
