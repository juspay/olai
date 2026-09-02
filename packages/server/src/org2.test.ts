import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { serializeOutline } from "@olai/format"
import { expect, test } from "bun:test"

import { compileOrg2Corpus } from "./org2.ts"

test("the packaged Org2 CLI compiles OLAI's on-disk outline", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-org2-cli-"))
  try {
    fs.writeFileSync(
      path.join(root, "house.org"),
      serializeOutline([
        { id: "house", ord: "a", title: "House" },
        { id: "kitchen", parent: "house", ord: "a", title: "Kitchen" },
      ]),
    )
    expect(() => compileOrg2Corpus(root)).not.toThrow()
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
