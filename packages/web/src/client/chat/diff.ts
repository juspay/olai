/**
 * Two texts, as the lines that differ.
 *
 * ACP carries a file edit as `oldText` and `newText` — never a unified diff —
 * so somebody has to compute one, and it is the CLIENT, beside every other
 * view-time derivation this app does. That keeps the wire carrying facts (what
 * the file said, what it says now) rather than a rendering of them, and it
 * means a diff is recomputed when a row is drawn rather than remembered
 * anywhere.
 *
 * **Hand-rolled rather than a dependency, deliberately.** The line diff a panel
 * needs is the ~100 lines below; the packages that do this (`diff`, `fast-diff`,
 * `diff-match-patch`) bring character-level algorithms, patch parsing and patch
 * application — a library's worth of surface for one of its functions, in a
 * bundle that ships to a browser. This codebase has taken that trade twice
 * before and written down why both times (`@olai/git` over `simple-git`, dates
 * as text over a date library): a handroll you can read is a smaller thing to
 * own than an adapter over somebody's else's model of the problem. Where a
 * dependency would earn it is character-level diffing inside a line, and that
 * is a feature this panel does not have.
 *
 * Three things it does that a naive LCS does not, and each is what makes the
 * result readable rather than merely correct:
 *
 *   - **common prefix and suffix come off the COMPARISON first.** An edit in
 *     the middle of a long file is the ordinary case, and trimming both ends
 *     turns the quadratic part into a few lines rather than the whole document.
 *     (They are still walked and still become rows — one cheap object per line
 *     — and the collapsing below is what keeps them off the screen. Emitting
 *     the ends pre-collapsed would make this O(the change) rather than O(the
 *     file); it is not worth splitting the one collapsing rule in two for a
 *     millisecond per rendered diff.)
 *   - **the comparison is BOUNDED.** The table is quadratic, and a browser
 *     rewriting a ten-thousand-line file must not be a frozen tab; past the
 *     budget the middle is reported as one removal and one addition, which is
 *     true and is what a diff of two unrelated texts looks like anyway. The
 *     answer SAYS SO (`wholesale`), because the trim is what makes it matter:
 *     every row is then a change, so the first rows are the top of the old
 *     file, which looks like an ordinary diff and is not one.
 *   - **unchanged runs collapse into a GAP.** Without it the first lines of a
 *     500-line file are 500 lines of context with the change somewhere below,
 *     and a panel that trims to the first few would show a reader nothing but
 *     unchanged text — the change would be exactly what the trim hid.
 */

/** One line of the rendering. `gap` is not a line of either file: it is the
 *  unchanged run between two changes, standing in for the lines it hides. */
export interface DiffLine {
  readonly kind: "same" | "add" | "remove" | "gap"
  /** The line itself, and `""` for a gap. */
  readonly text: string
  /** Where it sits in the file as it WAS, 1-based; `null` for an added line
   *  and for a gap. */
  readonly before: number | null
  /** ... and in the file as it IS. */
  readonly after: number | null
  /** How many unchanged lines a gap stands for. `0` on every other kind. */
  readonly hidden: number
}

export interface Diff {
  readonly lines: ReadonlyArray<DiffLine>
  readonly added: number
  readonly removed: number
  /** The file did not exist before this call — the protocol's own `null`
   *  `oldText`, kept as a fact rather than flattened into "every line added",
   *  because "created" and "rewritten from empty" are different news. */
  readonly created: boolean
  /**
   * The two sides were too far apart to line up, so this is a wholesale
   * replacement rather than a comparison: everything gone, then everything
   * arrived.
   *
   * CARRIED rather than kept quiet, because the trim is what makes it matter.
   * Past the budget every row is a change, so the first rows a trimmed view
   * shows are the top of the OLD file — which looks exactly like an ordinary
   * diff and is not one. A reader who is told can open it; a reader who is not
   * is reading something confidently misleading.
   */
  readonly wholesale: boolean
}

/** How many unchanged lines are kept either side of a change. Two is enough to
 *  place a hunk and few enough that the change is what a trimmed view shows. */
const CONTEXT = 2

/** The most cells the comparison table may have. 250k is a 500×500 line
 *  comparison AFTER the common ends are off, which is far past anything a
 *  person reads in a chat panel and far short of anything a browser notices. */
const CELLS = 250_000

/**
 * The lines that differ between what a file said and what it says now.
 *
 * `before` is `null` for a file the edit created, which is the protocol's own
 * spelling and is answered as `created` rather than as a diff against nothing.
 */
export const diffOf = (before: string | null, after: string): Diff => {
  const was = linesIn(before ?? "")
  const now = linesIn(after)
  const compared = compare(was, now)
  const lines = withGaps(compared.lines)
  // Counted in ONE pass over the rows rather than by filtering the array twice
  // for two numbers that are read together.
  let added = 0
  let removed = 0
  for (const line of lines) {
    if (line.kind === "add") added++
    else if (line.kind === "remove") removed++
  }
  return { lines, added, removed, created: before === null, wholesale: compared.wholesale }
}

/**
 * A text as its lines.
 *
 * The trailing newline every well-formed text file ends with is a TERMINATOR
 * rather than an empty last line, so it is dropped: keeping it makes every file
 * end in a phantom line, and appending to such a file reads as one line changed
 * (the empty one) and one added.
 */
const linesIn = (text: string): ReadonlyArray<string> => {
  if (text === "") return []
  const lines = text.split("\n")
  if (lines[lines.length - 1] === "") lines.pop()
  return lines
}

/** Every line of both sides, in order, each marked with what became of it —
 *  and whether the middle had to be given up on rather than compared. */
const compare = (
  was: ReadonlyArray<string>,
  now: ReadonlyArray<string>,
): { readonly lines: ReadonlyArray<DiffLine>; readonly wholesale: boolean } => {
  const lines: Array<DiffLine> = []
  let head = 0
  while (head < was.length && head < now.length && was[head] === now[head]) {
    lines.push(same(was[head]!, head + 1, head + 1))
    head++
  }
  let tail = 0
  while (
    tail < was.length - head && tail < now.length - head &&
    was[was.length - 1 - tail] === now[now.length - 1 - tail]
  ) {
    tail++
  }

  // The two middles are indexed from their own zero and numbered from `head`,
  // which is the whole of the bookkeeping: a line's number is where it sits in
  // ITS OWN file, and the common prefix is exactly how far both files are into
  // themselves when the middle starts.
  const middleWas = was.slice(head, was.length - tail)
  const middleNow = now.slice(head, now.length - tail)
  // The budget is decided HERE rather than inside the walk, because giving up
  // on lining the two sides up is a fact about the answer and the panel says
  // so — see {@link Diff.wholesale}.
  const wholesale = middleWas.length * middleNow.length > CELLS
  let i = 0
  let j = 0
  for (const step of steps(middleWas, middleNow, wholesale)) {
    if (step === "same") {
      lines.push(same(middleWas[i]!, head + i + 1, head + j + 1))
      i++
      j++
    } else if (step === "remove") {
      lines.push(gone(middleWas[i]!, head + i + 1))
      i++
    } else {
      lines.push(arrived(middleNow[j]!, head + j + 1))
      j++
    }
  }

  for (let back = tail; back > 0; back--) {
    lines.push(same(was[was.length - back]!, was.length - back + 1, now.length - back + 1))
  }
  return { lines, wholesale }
}

const same = (text: string, before: number, after: number): DiffLine => ({
  kind: "same",
  text,
  before,
  after,
  hidden: 0,
})

const gone = (text: string, before: number): DiffLine => ({
  kind: "remove",
  text,
  before,
  after: null,
  hidden: 0,
})

const arrived = (text: string, after: number): DiffLine => ({
  kind: "add",
  text,
  before: null,
  after,
  hidden: 0,
})

/**
 * What happens to each line of the two middles, in order.
 *
 * An EMPTY side needs no special case: the table below degenerates to one row
 * or one column and the two drains at the end emit the whole of the other side,
 * which is exactly "all added" or "all removed".
 */
const steps = (
  was: ReadonlyArray<string>,
  now: ReadonlyArray<string>,
  /** Whether the caller has already decided these two are too far apart to
   *  line up ({@link Diff.wholesale}): everything gone, then everything
   *  arrived, which is the shape a diff of two unrelated texts takes anyway. */
  wholesale: boolean,
): ReadonlyArray<"same" | "add" | "remove"> => {
  if (wholesale) {
    return [...was.map(() => "remove" as const), ...now.map(() => "add" as const)]
  }

  // The classic table: `table[i][j]` is the length of the longest common
  // subsequence of `was[i…]` and `now[j…]`, filled from the end so the
  // backtrack below runs forwards and emits its steps in reading order.
  const table: Array<Array<number>> = Array.from(
    { length: was.length + 1 },
    () => new Array<number>(now.length + 1).fill(0),
  )
  for (let i = was.length - 1; i >= 0; i--) {
    for (let j = now.length - 1; j >= 0; j--) {
      table[i]![j] = was[i] === now[j]
        ? table[i + 1]![j + 1]! + 1
        : Math.max(table[i + 1]![j]!, table[i]![j + 1]!)
    }
  }

  const walked: Array<"same" | "add" | "remove"> = []
  let i = 0
  let j = 0
  while (i < was.length && j < now.length) {
    if (was[i] === now[j]) {
      walked.push("same")
      i++
      j++
      continue
    }
    // A tie goes to the REMOVAL, so a replaced line reads as the old one
    // struck out above the new one rather than the other way round.
    if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      walked.push("remove")
      i++
    } else {
      walked.push("add")
      j++
    }
  }
  while (i++ < was.length) walked.push("remove")
  while (j++ < now.length) walked.push("add")
  return walked
}

/**
 * The same lines with long unchanged runs replaced by a gap.
 *
 * A run is only collapsed when it hides MORE than it would cost to show: two
 * lines of context each side plus a gap standing for one line is three rows
 * where three rows of context would have been. So the threshold is the context
 * either side plus two, and a file with no changes in it collapses to nothing
 * at all — which is what a diff of two identical texts should say.
 */
const withGaps = (lines: ReadonlyArray<DiffLine>): ReadonlyArray<DiffLine> => {
  const kept: Array<DiffLine> = []
  let run: Array<DiffLine> = []
  const flush = (leading: boolean, trailing: boolean) => {
    const head = leading ? 0 : CONTEXT
    const tail = trailing ? 0 : CONTEXT
    if (run.length <= head + tail + 1) {
      kept.push(...run)
    } else {
      if (!leading) kept.push(...run.slice(0, CONTEXT))
      kept.push({
        kind: "gap",
        text: "",
        before: null,
        after: null,
        hidden: run.length - head - tail,
      })
      if (!trailing) kept.push(...run.slice(run.length - CONTEXT))
    }
    run = []
  }

  let started = false
  for (const line of lines) {
    if (line.kind === "same") {
      run.push(line)
      continue
    }
    if (run.length > 0) flush(!started, false)
    started = true
    kept.push(line)
  }
  // The run at the END is trailing context: nothing follows it, so its tail is
  // not worth keeping. A file with no changes at all is one run that is both
  // leading and trailing, which collapses to a single gap.
  if (run.length > 0) flush(!started, true)
  return kept
}
