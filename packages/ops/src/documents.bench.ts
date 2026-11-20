import {
  bytesOf,
  brokenBy,
  type DocumentSummary,
  errorLine,
  heldCustom,
  markdownIn,
  nothing,
  type OutlineSet,
} from "@olai/format"
import { alternating, runtimeSaid } from "@olai/format/testlib"
import { setOf } from "./fixtures.testlib.ts"

import { documents } from "./query.ts"

const DOCS = Number(process.env["OLAI_BENCH_DOCS"] ?? 5000)

const bodyOf = (which: number): string => {
  const mark = which % 7 === 0 ? " 🔥" : ""
  return `# Note ${which}${mark}\n\n` +
    "lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(20)
}

const set = setOf(
  {},
  Array.from({ length: DOCS }, (_, which) => [
    `notes/${String(which).padStart(4, "0")}.md`,
    bodyOf(which),
  ] as const),
)

const listedByEncode = (at: OutlineSet): ReadonlyArray<DocumentSummary> => {
  const broken = brokenBy(at)
  return markdownIn(at).map((entry): DocumentSummary => {
    const errors = broken.get(entry.path)
    if (errors !== undefined) return { file: entry.path, unreadable: errors.map(errorLine) }
    const props = heldCustom(entry.props)
    return {
      file: entry.path,
      title: entry.title,
      bytes: bytesOf(entry.body),
      ...(nothing(props) ? {} : { props }),
    }
  })
}

const encoded = listedByEncode(set)
const remembered = documents(set)
if (JSON.stringify(encoded) !== JSON.stringify(remembered)) {
  throw new Error(
    "listing-sizes drifted from recompute-from-body, so neither number means anything",
  )
}

const bytes = encoded.reduce((sum, row) => sum + ("bytes" in row ? row.bytes : 0), 0)

const [encodeMs, rememberedMs] = alternating([
  () => listedByEncode(set),
  () => documents(set),
])

console.log(
  `vault: ${DOCS} documents, ${bytes} bytes of body\n` +
    `${runtimeSaid()}\n`,
)
console.log(`encode      ${encodeMs.toFixed(2)}ms`)
console.log(`remembered  ${rememberedMs.toFixed(2)}ms`)
console.log(
  `\nthe listing against the encode it replaced: ` +
    `${(encodeMs / rememberedMs).toFixed(1)}×`,
)
