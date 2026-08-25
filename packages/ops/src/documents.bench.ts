/**
 * What `list_documents` costs: re-encoding every body vs reading the
 * remembered byte count.
 *
 * IT IS A LEG, NOT A CLAIM (`just bench`). Perf numbers are reported
 * artifacts, never CI gates — a timing that fails a lane on a busy machine
 * teaches nobody anything. The brief's 5k-document corpus is the default;
 * size it with `OLAI_BENCH_DOCS`.
 *
 * TWO ARMS over one generated vault:
 *
 *   - `encode` — the listing as it stood: `bytesOf(entry.body)` per document,
 *     a full UTF-8 encode of every served `.md` on every call;
 *   - `remembered` — the listing as it is: `entry.bytes`, paid at decode.
 *
 * THE TWO MUST ANSWER THE SAME VALUE, asserted before anything is timed. It
 * is what stops this being a benchmark of an arm that answers nothing: the
 * fast one could "win" by returning zeroes and the comparison would still
 * print. The unit test holds the same equality over the suite corpus and a
 * generated one; this is that gate at the size the numbers are about.
 *
 * Alternating, warmed, median of several rounds ({@link alternating}): two
 * arms run one after the other are two arms of a machine in two moods, and
 * going second in a round is worth more than some of the differences this is
 * asked to see.
 */

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
import { alternating, runtimeSaid, setOf } from "@olai/format/testlib"

import { documents } from "./query.ts"

const DOCS = Number(process.env["OLAI_BENCH_DOCS"] ?? 5000)

const bodyOf = (which: number): string => {
  // Emoji on a seventh of them so a UTF-16-unit count would already be the
  // wrong answer at this size, the same classic failure the differential
  // test names.
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

/**
 * The listing as it STOOD: encode every body to report its size. Kept here
 * because two arms below are about exactly what that costs, and a before/after
 * the harness cannot print is the unreproducible laptop sample these legs
 * exist to retire.
 */
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
