import { describe, expect, it } from "bun:test"
import { commandWords } from "./agent/command.ts"

describe("scripted agent command arguments", () => {
  it("keeps a refreshed node binding out of a mutation's node id", () => {
    const prompt = "done hinges\n\n[olai] This conversation is the node agent for “install the cabinets” — the node `install` in `yard.olai`.\n[olai] That node's SUBTREE is your memory."
    expect(commandWords(prompt)).toEqual(["done", "hinges"])
  })

  it("preserves multiword arguments while separating context and attachments", () => {
    expect(commandWords("add fit the cabinets\n\nNode in context: `install`\nAttached file: sketch.png"))
      .toEqual(["add", "fit", "the", "cabinets"])
    expect(commandWords("  settings\tupdate\r\n")).toEqual(["settings", "update"])
  })
})
