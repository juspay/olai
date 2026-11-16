/**
 * WHAT MOVED SINCE THE VERSION SOMEBODY SAID YES TO — the paused page's whole
 * middle, as lines rather than as a file.
 *
 * ## Why a diff is the right question here, and the file is not
 *
 * Approving once is not approving whatever the plugin becomes, so an edit to
 * approved code pauses it and asks again. But *asks again* must not mean *read
 * all of it again*: the person already read this plugin, said yes to it, and
 * has been running it. What changed is one class name, and that is the whole
 * of the new decision. A page that re-presented eighty lines would be asking a
 * question whose answer it has already been given, and the answer to a question
 * like that is a reflex rather than a reading.
 *
 * ## The algorithm is the oldest one, and that is deliberate
 *
 * A longest-common-subsequence walk over LINES, with the common head and tail
 * taken off first. Not a word diff, not a syntactic one: the input is two
 * revisions of a file an agent wrote minutes apart, where the overwhelming
 * common case is a handful of changed lines in a file nobody reordered. The
 * quadratic middle is bounded by taking the shared ends off first and, past a
 * {@link LIMIT} of changed lines, by refusing to be clever — two halves that
 * share almost nothing are a REWRITE, and the honest drawing of a rewrite is
 * the two files, not a thousand interleaved pairs.
 *
 * It is here rather than in a general package because nothing else in this tree
 * diffs text: the outline's own diff is over NODES and a commit's is git's. A
 * shared helper over one caller is a package boundary bought with nothing.
 */

/** One drawn line: kept, taken away, or put there. */
export interface Line {
  readonly kind: "same" | "del" | "add"
  readonly text: string
}

/**
 * Past this many differing lines the pair is a rewrite rather than an edit, and
 * is drawn as one: everything removed, then everything added. Chosen as the
 * size of a screenful — past a screen of changes nobody is reading line pairs
 * anyway, and the quadratic walk stops being worth running.
 */
const LIMIT = 400

export const diffLines = (before: string, after: string): ReadonlyArray<Line> => {
  const left = before === "" ? [] : before.replace(/\n$/, "").split("\n")
  const right = after === "" ? [] : after.replace(/\n$/, "").split("\n")
  // THE SHARED ENDS COME OFF FIRST. It is what makes the walk cheap on the
  // ordinary case (an agent changed one line in the middle of a file) and it
  // is also what makes the drawing right: a line that never moved is context.
  let head = 0
  while (head < left.length && head < right.length && left[head] === right[head]) head += 1
  let tail = 0
  while (
    tail < left.length - head
    && tail < right.length - head
    && left[left.length - 1 - tail] === right[right.length - 1 - tail]
  ) tail += 1
  const from = left.slice(head, left.length - tail)
  const to = right.slice(head, right.length - tail)
  const middle = from.length + to.length > LIMIT
    ? [...from.map((text): Line => ({ kind: "del", text })), ...to.map((text): Line => ({ kind: "add", text }))]
    : walk(from, to)
  return [
    ...left.slice(0, head).map((text): Line => ({ kind: "same", text })),
    ...middle,
    ...left.slice(left.length - tail).map((text): Line => ({ kind: "same", text })),
  ]
}

/** The longest common subsequence of two line runs, as the drawn lines. The
 *  table is `(from.length + 1) × (to.length + 1)` lengths; the walk back out of
 *  it prefers a removal before an addition so a replaced line reads old-then-new,
 *  which is the order every diff a programmer has ever read puts them in. */
const walk = (from: ReadonlyArray<string>, to: ReadonlyArray<string>): ReadonlyArray<Line> => {
  const width = to.length + 1
  const lengths = new Uint32Array((from.length + 1) * width)
  for (let a = from.length - 1; a >= 0; a -= 1) {
    for (let b = to.length - 1; b >= 0; b -= 1) {
      lengths[a * width + b] = from[a] === to[b]
        ? lengths[(a + 1) * width + b + 1]! + 1
        : Math.max(lengths[(a + 1) * width + b]!, lengths[a * width + b + 1]!)
    }
  }
  const lines: Line[] = []
  let a = 0
  let b = 0
  while (a < from.length && b < to.length) {
    if (from[a] === to[b]) { lines.push({ kind: "same", text: from[a]! }); a += 1; b += 1 }
    else if (lengths[(a + 1) * width + b]! >= lengths[a * width + b + 1]!) { lines.push({ kind: "del", text: from[a]! }); a += 1 }
    else { lines.push({ kind: "add", text: to[b]! }); b += 1 }
  }
  for (; a < from.length; a += 1) lines.push({ kind: "del", text: from[a]! })
  for (; b < to.length; b += 1) lines.push({ kind: "add", text: to[b]! })
  return lines
}

/**
 * HOW MANY LINES MOVED — the banner's own count, read off the same walk the
 * block below it draws, so *One line changed in browser.tsx* is a sentence
 * about the diff a person is looking at.
 *
 * A REPLACED LINE IS ONE LINE, which is the whole of why this is not a count
 * of non-`same` rows. The walk draws a replacement as a removal followed by an
 * addition — that is how every diff a programmer has read puts them, and it is
 * two ROWS for one changed line. Counting rows said "2 lines changed" of an
 * edit to a single line, and a banner that inflates what it is asking somebody
 * to re-read is a banner they stop believing.
 *
 * So each RUN of changed rows counts as the longer of its two sides: three
 * lines replaced by one is three, one replaced by three is three, and a line
 * edited is one. Runs are summed, so changes in two places are two.
 */
export const changedCount = (lines: ReadonlyArray<Line>): number => {
  let total = 0
  let dels = 0
  let adds = 0
  const settle = () => { total += Math.max(dels, adds); dels = 0; adds = 0 }
  for (const line of lines) {
    if (line.kind === "same") settle()
    else if (line.kind === "del") dels += 1
    else adds += 1
  }
  settle()
  return total
}
